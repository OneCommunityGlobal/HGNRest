const mongoose = require('mongoose');
const logger = require('../../startup/logger');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const { invTypeBase } = require('../../models/bmdashboard/buildingInventoryType');
const { parseMultiSelectQueryParam } = require('../../utilities/queryParamParser');
const {
  parseAndNormalizeDateRangeUTC,
  normalizeStartDate,
} = require('../../utilities/materialCostCorrelationDateUtils');
const {
  getEarliestRelevantMaterialDate,
  aggregateMaterialUsage,
  aggregateMaterialCost,
  buildCostCorrelationResponse,
} = require('../../utilities/materialCostCorrelationHelpers');

// HTTP status codes
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// eslint-disable-next-line max-lines-per-function
const bmMaterialsController = function (BuildingMaterial) {
  const bmMaterialsList = async function _matsList(req, res) {
    try {
      BuildingMaterial.find()
        .populate([
          {
            path: 'project',
            select: '_id name',
          },
          {
            path: 'itemType',
            select: '_id name unit',
          },
          {
            path: 'updateRecord',
            populate: {
              path: 'createdBy',
              select: '_id firstName lastName email',
            },
          },
          {
            path: 'purchaseRecord',
            populate: {
              path: 'requestedBy',
              select: '_id firstName lastName email',
            },
          },
        ])
        .exec()
        .then((results) => res.status(200).send(results))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  const bmPurchaseMaterials = async function (req, res) {
    const {
      primaryId: projectId,
      secondaryId: matTypeId,
      quantity,
      priority,
      brand: brandPref,
      requestor: { requestorId },
    } = req.body;

    try {
      // check if requestor has permission to make purchase request
      //! Note: this code is disabled until permissions are added
      // TODO: uncomment this code to execute auth check
      // const { buildingManager: bmId } = await buildingProject.findById(projectId, 'buildingManager').exec();
      // if (bmId !== requestorId) {
      //   res.status(403).send({ message: 'You are not authorized to edit this record.' });
      //   return;
      // }

      // check if the material is already being used in the project
      // if no, add a new document to the collection
      // if yes, update the existing document
      const newPurchaseRecord = {
        quantity,
        priority,
        brandPref,
        requestedBy: requestorId,
      };
      const doc = await BuildingMaterial.findOne({
        project: projectId,
        itemType: matTypeId,
      });
      if (!doc) {
        const newDoc = {
          itemType: matTypeId,
          project: projectId,
          purchaseRecord: [newPurchaseRecord],
          stockBought: quantity,
        };
        BuildingMaterial.create(newDoc)
          .then(() => res.status(201).send())
          .catch((error) => res.status(500).send(error));
        return;
      }
      doc.stockBought += quantity;
      BuildingMaterial.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(doc._id) },
        { $push: { purchaseRecord: newPurchaseRecord } },
      )
        .exec()
        .then(() => res.status(201).send())
        .catch((error) => res.status(500).send(error));
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const bmPostMaterialUpdateRecord = function (req, res) {
    const payload = req.body;
    let quantityUsed = +req.body.quantityUsed;
    let quantityWasted = +req.body.quantityWasted;
    const { material } = req.body;
    if (payload.QtyUsedLogUnit === 'percent' && quantityWasted >= 0) {
      quantityUsed = +((+quantityUsed / 100) * material.stockAvailable).toFixed(4);
    }
    if (payload.QtyWastedLogUnit === 'percent' && quantityUsed >= 0) {
      quantityWasted = +((+quantityWasted / 100) * material.stockAvailable).toFixed(4);
    }

    if (
      quantityUsed > material.stockAvailable ||
      quantityWasted > material.stockAvailable ||
      quantityUsed + quantityWasted > material.stockAvailable
    ) {
      res
        .status(500)
        .send(
          'Please check the used and wasted stock values. Either individual values or their sum exceeds the total stock available.',
        );
    } else {
      let newStockUsed = +material.stockUsed + parseFloat(quantityUsed);
      let newStockWasted = +material.stockWasted + parseFloat(quantityWasted);
      let newAvailable =
        +material.stockAvailable - parseFloat(quantityUsed) - parseFloat(quantityWasted);
      newStockUsed = parseFloat(newStockUsed.toFixed(4));
      newStockWasted = parseFloat(newStockWasted.toFixed(4));
      newAvailable = parseFloat(newAvailable.toFixed(4));
      BuildingMaterial.updateOne(
        { _id: req.body.material._id },

        {
          $set: {
            stockUsed: newStockUsed,
            stockWasted: newStockWasted,
            stockAvailable: newAvailable,
          },
          $push: {
            updateRecord: {
              date: req.body.date,
              createdBy: req.body.requestor.requestorId,
              quantityUsed,
              quantityWasted,
            },
          },
        },
      )
        .then((results) => {
          res.status(200).send(results);
        })
        .catch((error) => res.status(500).send({ message: error }));
    }
  };

  const bmPostMaterialUpdateBulk = function (req, res) {
    const materialUpdates = req.body.upadateMaterials;
    let errorFlag = false;
    const updateRecordsToBeAdded = [];
    for (let i = 0; i < materialUpdates.length; i += 1) {
      const payload = materialUpdates[i];
      let quantityUsed = +payload.quantityUsed;
      let quantityWasted = +payload.quantityWasted;
      const { material } = payload;
      if (payload.QtyUsedLogUnit === 'percent' && quantityWasted >= 0) {
        quantityUsed = +((+quantityUsed / 100) * material.stockAvailable).toFixed(4);
      }
      if (payload.QtyWastedLogUnit === 'percent' && quantityUsed >= 0) {
        quantityWasted = +((+quantityWasted / 100) * material.stockAvailable).toFixed(4);
      }

      let newStockUsed = +material.stockUsed + parseFloat(quantityUsed);
      let newStockWasted = +material.stockWasted + parseFloat(quantityWasted);
      let newAvailable =
        +material.stockAvailable - parseFloat(quantityUsed) - parseFloat(quantityWasted);
      newStockUsed = parseFloat(newStockUsed.toFixed(4));
      newStockWasted = parseFloat(newStockWasted.toFixed(4));
      newAvailable = parseFloat(newAvailable.toFixed(4));
      if (newAvailable < 0) {
        errorFlag = true;
        break;
      }
      updateRecordsToBeAdded.push({
        updateId: material._id,
        set: {
          stockUsed: newStockUsed,
          stockWasted: newStockWasted,
          stockAvailable: newAvailable,
        },
        updateValue: {
          createdBy: req.body.requestor.requestorId,
          quantityUsed,
          quantityWasted,
          date: req.body.date,
        },
      });
    }

    try {
      if (errorFlag) {
        res.status(500).send('Stock quantities submitted seems to be invalid');
        return;
      }
      const updatePromises = updateRecordsToBeAdded.map((updateItem) =>
        BuildingMaterial.updateOne(
          { _id: updateItem.updateId },
          {
            $set: updateItem.set,
            $push: { updateRecord: updateItem.updateValue },
          },
        ).exec(),
      );
      Promise.all(updatePromises)
        .then((results) => {
          res.status(200).send({
            result: `Successfully posted log for ${results.length} Material records.`,
          });
        })
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  const bmupdatePurchaseStatus = async function (req, res) {
    const { purchaseId, status, quantity } = req.body;
    try {
      const material = await BuildingMaterial.findOne({ 'purchaseRecord._id': purchaseId });

      if (!material) {
        return res.status(404).send('Purchase not found');
      }

      const purchaseRecord = material.purchaseRecord.find(
        (record) => record._id.toString() === purchaseId,
      );

      if (!purchaseRecord) {
        return res.status(404).send('Purchase record not found');
      }

      if (purchaseRecord.status !== 'Pending') {
        return res
          .status(400)
          .send(
            `Purchase status can only be updated from 'Pending'. Current status is '${purchaseRecord.status}'.`,
          );
      }
      const updateObject = {
        $set: { 'purchaseRecord.$.status': status },
      };
      if (status === 'Approved') {
        updateObject.$inc = { stockBought: quantity };
      }

      const updatedMaterial = await BuildingMaterial.findOneAndUpdate(
        { 'purchaseRecord._id': purchaseId },
        updateObject,
        { new: true },
      );

      if (!updatedMaterial) {
        return res.status(500).send('Failed to apply purchase status update to material.');
      }

      res.status(200).send(`Purchase ${status.toLowerCase()} successfully`);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const bmGetMaterialSummaryByProject = async function (req, res) {
    const { projectId } = req.params;
    const { materialType, increaseOverLastWeek } = req.query;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: 'Invalid projectId' });
    }

    try {
      const query = {
        project: mongoose.Types.ObjectId(projectId),
      };

      if (materialType) {
        if (mongoose.Types.ObjectId.isValid(materialType)) {
          query.itemType = mongoose.Types.ObjectId(materialType);
        } else {
          return res.status(400).json({ error: 'Invalid materialId' });
        }
      }

      const materials = await BuildingMaterial.find(query);

      let totalAvailable = 0;
      let totalUsed = 0;
      let totalWasted = 0;

      let usedLastWeek = 0;
      let usedThisWeek = 0;

      const now = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const nowStr = now.toISOString().split('T')[0];
      const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
      const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

      const toDateOnlyStr = (date) => new Date(date).toISOString().split('T')[0];

      // If increaseOverLastWeek=true, filter materials based on usage activity in the last 7 days
      let filteredMaterials = materials;
      if (increaseOverLastWeek === 'true') {
        filteredMaterials = materials.filter((mat) => {
          let lastWeek = 0;
          let thisWeek = 0;

          (mat.updateRecord || []).forEach((record) => {
            const recordDateStr = toDateOnlyStr(record.date);
            if (recordDateStr >= oneWeekAgoStr && recordDateStr <= nowStr) {
              thisWeek += record.quantityUsed || 0;
            } else if (recordDateStr >= twoWeeksAgoStr && recordDateStr < oneWeekAgoStr) {
              lastWeek += record.quantityUsed || 0;
            }
          });

          return thisWeek > lastWeek;
        });
      }

      // Aggregate material data and calculate usage values
      filteredMaterials.forEach((mat) => {
        totalAvailable += mat.stockAvailable || 0;
        totalUsed += mat.stockUsed || 0;
        totalWasted += mat.stockWasted || 0;

        const updates = mat.updateRecord || [];
        updates.forEach((record) => {
          const recordDate = new Date(record.date);
          const recordDateOnly = toDateOnlyStr(recordDate);
          if (recordDateOnly >= oneWeekAgoStr && recordDateOnly <= nowStr) {
            usedThisWeek += record.quantityUsed || 0;
          } else if (recordDateOnly >= twoWeeksAgoStr && recordDateOnly < oneWeekAgoStr) {
            usedLastWeek += record.quantityUsed || 0;
          }
        });
      });
      // console.log(usedThisWeek, usedLastWeek);

      // Calculate usage increase percentage
      let usageIncreasePercent = 0;
      if (usedLastWeek > 0) {
        usageIncreasePercent = ((usedThisWeek - usedLastWeek) / usedLastWeek) * 100;
        usageIncreasePercent = parseFloat(usageIncreasePercent.toFixed(2));
      }

      res.status(200).json({
        availableMaterials: totalAvailable,
        usedMaterials: totalUsed,
        wastedMaterials: totalWasted,
        increaseOverLastWeek: usageIncreasePercent,
      });
    } catch (err) {
      console.error('Error in bmGetMaterialSummaryByProject:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // eslint-disable-next-line max-lines-per-function
  const bmGetMaterialCostCorrelation = async function (req, res) {
    try {
      // 1. Extract and parse query parameters
      let projectIds;
      let materialTypeIds;
      try {
        projectIds = parseMultiSelectQueryParam(req, 'projectId', true);
        materialTypeIds = parseMultiSelectQueryParam(req, 'materialType', true);
      } catch (error) {
        if (error.type === 'OBJECTID_VALIDATION_ERROR') {
          logger.logException(error, 'bmGetMaterialCostCorrelation - query parameter validation', {
            method: req.method,
            path: req.path,
            query: req.query,
          });
          return res.status(HTTP_STATUS_BAD_REQUEST).json({ error: error.message });
        }
        throw error;
      }

      // Extract date parameters as raw strings
      const startDateInput = req.query.startDate;
      const endDateInput = req.query.endDate;

      // 2. Compute default start date if needed
      let defaultStartDate;
      if (!startDateInput || (typeof startDateInput === 'string' && startDateInput.trim() === '')) {
        const earliestDate = await getEarliestRelevantMaterialDate(
          projectIds,
          materialTypeIds,
          BuildingMaterial,
        );
        if (earliestDate) {
          defaultStartDate = earliestDate;
        } else {
          // Fallback: today's start-of-day UTC
          defaultStartDate = normalizeStartDate(new Date(), true);
        }
      }

      // 3. Parse and normalize date range
      let dateRangeMeta;
      try {
        dateRangeMeta = parseAndNormalizeDateRangeUTC(
          startDateInput,
          endDateInput,
          defaultStartDate,
          undefined,
        );
      } catch (error) {
        logger.logException(error, 'bmGetMaterialCostCorrelation - date range parsing', {
          method: req.method,
          path: req.path,
          query: req.query,
        });
        if (error.type === 'DATE_PARSE_ERROR') {
          return res.status(HTTP_STATUS_UNPROCESSABLE_ENTITY).json({ error: error.message });
        }
        if (error.type === 'DATE_RANGE_ERROR') {
          return res.status(HTTP_STATUS_BAD_REQUEST).json({ error: error.message });
        }
        return res.status(400).json({ error: error.message });
      }

      const { effectiveStart, effectiveEnd } = dateRangeMeta;

      // 4. Run aggregations in parallel
      let usageData;
      let costData;
      try {
        const filters = { projectIds, materialTypeIds };
        const dateRange = { effectiveStart, effectiveEnd };

        [usageData, costData] = await Promise.all([
          aggregateMaterialUsage(BuildingMaterial, filters, dateRange),
          aggregateMaterialCost(BuildingMaterial, filters, dateRange),
        ]);
      } catch (error) {
        logger.logException(error, 'bmGetMaterialCostCorrelation - aggregation', {
          method: req.method,
          path: req.path,
          query: req.query,
        });
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: 'Internal server error while aggregating material data',
        });
      }

      // 5. Build response
      let responseObject;
      try {
        const requestParams = {
          projectIds,
          materialTypeIds,
          dateRangeMeta,
        };
        const models = {
          BuildingProject,
          BuildingInventoryType: invTypeBase,
        };
        responseObject = await buildCostCorrelationResponse(
          usageData,
          costData,
          requestParams,
          models,
        );
      } catch (error) {
        logger.logException(error, 'bmGetMaterialCostCorrelation - response building', {
          method: req.method,
          path: req.path,
          query: req.query,
        });
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: 'Internal server error while building response',
        });
      }

      // 6. Send response
      return res.status(200).json(responseObject);
    } catch (error) {
      // Global error handling wrapper
      logger.logException(error, 'bmGetMaterialCostCorrelation - unexpected error', {
        method: req.method,
        path: req.path,
        query: req.query,
      });
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
    }
  };

  return {
    bmMaterialsList,
    bmPostMaterialUpdateRecord,
    bmPostMaterialUpdateBulk,
    bmPurchaseMaterials,
    bmupdatePurchaseStatus,
    bmGetMaterialSummaryByProject,
    bmGetMaterialCostCorrelation,
  };
};

module.exports = bmMaterialsController;
