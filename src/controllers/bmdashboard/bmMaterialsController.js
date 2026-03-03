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
  resolveProjectNamesToIds,
  resolveMaterialNamesToIds,
} = require('../../utilities/materialCostCorrelationHelpers');

// HTTP status codes
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// Decimal precision for quantity calculations
const DECIMAL_PRECISION = 4;

// Time period constants (days)
const DAYS_IN_WEEK = 7;
const DAYS_IN_TWO_WEEKS = 14;

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

  /** @returns {{ status: number, message: string, field: string }|null} Validation error or null if valid. */
  const validatePurchaseMaterialsBody = function (body) {
    const {
      primaryId: projectId,
      secondaryId: matTypeId,
      quantity,
      priority,
      requestor: { requestorId } = {},
    } = body || {};
    if (!projectId) return { status: 400, message: 'Project is required', field: 'projectId' };
    if (!matTypeId) return { status: 400, message: 'Material is required', field: 'matTypeId' };
    if (!quantity && quantity !== 0)
      return { status: 400, message: 'Quantity is required', field: 'quantity' };
    if (!priority) return { status: 400, message: 'Priority is required', field: 'priority' };
    if (!requestorId)
      return { status: 400, message: 'Requestor information is required', field: 'requestorId' };
    if (!mongoose.Types.ObjectId.isValid(projectId))
      return { status: 400, message: 'Invalid project ID format', field: 'projectId' };
    if (!mongoose.Types.ObjectId.isValid(matTypeId))
      return { status: 400, message: 'Invalid material ID format', field: 'matTypeId' };
    if (!mongoose.Types.ObjectId.isValid(requestorId))
      return { status: 400, message: 'Invalid requestor ID format', field: 'requestorId' };
    const quantityNum = Number(quantity);
    if (Number.isNaN(quantityNum))
      return { status: 400, message: 'Quantity must be a valid number', field: 'quantity' };
    if (quantityNum <= 0)
      return { status: 400, message: 'Quantity must be greater than 0', field: 'quantity' };
    const validPriorities = ['Low', 'Medium', 'High'];
    if (!validPriorities.includes(priority))
      return {
        status: 400,
        message: 'Priority must be one of: Low, Medium, High',
        field: 'priority',
      };
    return null;
  };

  const performMaterialPurchase = async function (body, quantityNum, res) {
    const projectObjectId = new mongoose.Types.ObjectId(body.primaryId);
    const matTypeObjectId = new mongoose.Types.ObjectId(body.secondaryId);
    const newPurchaseRecord = {
      quantity: quantityNum,
      priority: body.priority,
      brandPref: body.brand,
      requestedBy: body.requestor?.requestorId,
    };
    const doc = await BuildingMaterial.findOne({
      project: projectObjectId,
      itemType: matTypeObjectId,
    });
    if (!doc) {
      const newDoc = {
        itemType: matTypeObjectId,
        project: projectObjectId,
        purchaseRecord: [newPurchaseRecord],
        stockBought: quantityNum,
      };
      return BuildingMaterial.create(newDoc)
        .then(() => res.status(201).send())
        .catch((error) => res.status(500).send(error));
    }
    return BuildingMaterial.findOneAndUpdate(
      { _id: doc._id },
      { $push: { purchaseRecord: newPurchaseRecord } },
    )
      .exec()
      .then(() => res.status(201).send())
      .catch((error) => res.status(500).send(error));
  };

  const bmPurchaseMaterials = async function (req, res) {
    const { body } = req;
    try {
      const validation = validatePurchaseMaterialsBody(body);
      if (validation) {
        return res
          .status(validation.status)
          .json({ message: validation.message, field: validation.field });
      }
      const quantityNum = Number(body.quantity);
      await performMaterialPurchase(body, quantityNum, res);
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
      quantityUsed = +((+quantityUsed / 100) * material.stockAvailable).toFixed(DECIMAL_PRECISION);
    }
    if (payload.QtyWastedLogUnit === 'percent' && quantityUsed >= 0) {
      quantityWasted = +((+quantityWasted / 100) * material.stockAvailable).toFixed(
        DECIMAL_PRECISION,
      );
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
      let newStockUsed = +material.stockUsed + Number.parseFloat(quantityUsed);
      let newStockWasted = +material.stockWasted + Number.parseFloat(quantityWasted);
      let newAvailable =
        +material.stockAvailable -
        Number.parseFloat(quantityUsed) -
        Number.parseFloat(quantityWasted);
      newStockUsed = Number.parseFloat(newStockUsed.toFixed(DECIMAL_PRECISION));
      newStockWasted = Number.parseFloat(newStockWasted.toFixed(DECIMAL_PRECISION));
      newAvailable = Number.parseFloat(newAvailable.toFixed(DECIMAL_PRECISION));
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
        quantityUsed = +((+quantityUsed / 100) * material.stockAvailable).toFixed(
          DECIMAL_PRECISION,
        );
      }
      if (payload.QtyWastedLogUnit === 'percent' && quantityUsed >= 0) {
        quantityWasted = +((+quantityWasted / 100) * material.stockAvailable).toFixed(
          DECIMAL_PRECISION,
        );
      }

      let newStockUsed = +material.stockUsed + parseFloat(quantityUsed);
      let newStockWasted = +material.stockWasted + parseFloat(quantityWasted);
      let newAvailable =
        +material.stockAvailable - parseFloat(quantityUsed) - parseFloat(quantityWasted);
      newStockUsed = parseFloat(newStockUsed.toFixed(DECIMAL_PRECISION));
      newStockWasted = parseFloat(newStockWasted.toFixed(DECIMAL_PRECISION));
      newAvailable = parseFloat(newAvailable.toFixed(DECIMAL_PRECISION));
      if (newAvailable < 0) {
        errorFlag = true;
        break;
      }
      if (!mongoose.Types.ObjectId.isValid(material._id)) {
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
      const updatePromises = updateRecordsToBeAdded.map((updateItem) => {
        const materialObjectId = new mongoose.Types.ObjectId(updateItem.updateId);
        return BuildingMaterial.updateOne(
          { _id: materialObjectId },
          {
            $set: updateItem.set,
            $push: { updateRecord: updateItem.updateValue },
          },
        ).exec();
      });
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
      if (!purchaseId || !mongoose.Types.ObjectId.isValid(purchaseId)) {
        return res.status(400).json({ message: 'Invalid purchase ID format', field: 'purchaseId' });
      }
      const purchaseObjectId = new mongoose.Types.ObjectId(purchaseId);
      const material = await BuildingMaterial.findOne({ 'purchaseRecord._id': purchaseObjectId });

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
        { 'purchaseRecord._id': purchaseObjectId },
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
      const projectObjectId = new mongoose.Types.ObjectId(projectId);
      const query = {
        project: projectObjectId,
      };

      if (materialType) {
        if (mongoose.Types.ObjectId.isValid(materialType)) {
          query.itemType = new mongoose.Types.ObjectId(materialType);
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
      oneWeekAgo.setDate(oneWeekAgo.getDate() - DAYS_IN_WEEK);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - DAYS_IN_TWO_WEEKS);

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
      logger.logException(err, 'bmGetMaterialSummaryByProject', {
        method: req.method,
        path: req.path,
        params: req.params,
        query: req.query,
      });
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
    }
  };

  /**
   * Compute default start date if startDateInput is not provided.
   * Uses earliest relevant material date or falls back to today.
   *
   * @param {string|undefined} startDateInput - Start date input from query
   * @param {string[]} projectIds - Project IDs for filtering
   * @param {string[]} materialTypeIds - Material type IDs for filtering
   * @returns {Promise<Date|undefined>} Default start date or undefined
   */
  const computeDefaultStartDate = async function (startDateInput, projectIds, materialTypeIds) {
    if (startDateInput && typeof startDateInput === 'string' && startDateInput.trim() !== '') {
      return undefined;
    }

    const earliestDate = await getEarliestRelevantMaterialDate(
      projectIds,
      materialTypeIds,
      BuildingMaterial,
    );

    if (earliestDate) {
      return earliestDate;
    }

    // Fallback: today's start-of-day UTC
    return normalizeStartDate(new Date(), true);
  };

  /**
   * Handle date range parsing errors and return appropriate HTTP response.
   *
   * @param {Object} error - Error object from date parsing
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object|undefined} Response object if error handled, undefined otherwise
   */
  const handleDateRangeError = function (error, req, res) {
    // Validation errors are expected and return proper HTTP responses - no need to log as exceptions
    if (error.type === 'DATE_PARSE_ERROR') {
      return res.status(HTTP_STATUS_UNPROCESSABLE_ENTITY).json({ error: error.message });
    }
    if (error.type === 'DATE_RANGE_ERROR') {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({ error: error.message });
    }
    return res.status(HTTP_STATUS_BAD_REQUEST).json({ error: error.message });
  };

  /**
   * Handle query parameter validation errors and return appropriate HTTP response.
   *
   * @param {Object} error - Error object from parameter validation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object|undefined} Response object if error handled, undefined otherwise
   */
  const handleQueryParamError = function (error, req, res) {
    // Validation errors are expected and return proper HTTP responses - no need to log as exceptions
    if (error.type === 'OBJECTID_VALIDATION_ERROR' || error.type === 'NAME_RESOLUTION_ERROR') {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({ error: error.message });
    }
    return undefined;
  };

  /**
   * Extract and resolve query parameters (IDs and names) to ObjectId arrays.
   * Handles both ID-based and name-based parameters, resolving names to IDs.
   *
   * @param {Object} req - Express request object
   * @returns {Promise<{projectIds: string[], materialTypeIds: string[]}>} Resolved ID arrays
   * @throws {Object} Structured error objects for validation/resolution failures
   */
  const extractAndResolveQueryParams = async function (req) {
    // Parse ID parameters (if provided)
    const projectIdsFromParam = parseMultiSelectQueryParam(req, 'projectId', true);
    const materialTypeIdsFromParam = parseMultiSelectQueryParam(req, 'materialType', true);

    // Parse name parameters (if provided, no ObjectId validation)
    const projectNames = parseMultiSelectQueryParam(req, 'projectName', false);
    const materialNames = parseMultiSelectQueryParam(req, 'materialName', false);

    let projectIds = projectIdsFromParam;
    let materialTypeIds = materialTypeIdsFromParam;

    // Resolve names to IDs if provided
    if (projectNames.length > 0) {
      const resolvedProjectIds = await resolveProjectNamesToIds(projectNames, BuildingProject);
      projectIds = [...projectIdsFromParam, ...resolvedProjectIds];
    }

    if (materialNames.length > 0) {
      const resolvedMaterialIds = await resolveMaterialNamesToIds(materialNames, invTypeBase);
      materialTypeIds = [...materialTypeIdsFromParam, ...resolvedMaterialIds];
    }

    // Remove duplicates from combined arrays
    return {
      projectIds: [...new Set(projectIds)],
      materialTypeIds: [...new Set(materialTypeIds)],
    };
  };

  const bmGetMaterialCostCorrelation = async function (req, res) {
    try {
      // 1. Extract and parse query parameters (IDs and names)
      let projectIds;
      let materialTypeIds;

      try {
        const resolvedParams = await extractAndResolveQueryParams(req);
        projectIds = resolvedParams.projectIds;
        materialTypeIds = resolvedParams.materialTypeIds;
      } catch (error) {
        const errorResponse = handleQueryParamError(error, req, res);
        if (errorResponse) {
          return errorResponse;
        }
        throw error;
      }

      // Extract date parameters as raw strings
      const startDateInput = req.query.startDate;
      const endDateInput = req.query.endDate;

      // 2. Compute default start date if needed
      const defaultStartDate = await computeDefaultStartDate(
        startDateInput,
        projectIds,
        materialTypeIds,
      );

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
        return handleDateRangeError(error, req, res);
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

  const DAYS_IN_STOCK_RISK_PERIOD = 30;
  const SENTINEL_NO_USAGE_DATA = 999;

  /** @returns {{ query: Object }|{ error: { status: number, body: Object }}} */
  const buildStockOutRiskQuery = function (projectIds) {
    const query = {};
    if (!projectIds || projectIds === 'all' || typeof projectIds !== 'string') {
      return { query };
    }
    const projectIdArray = projectIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    if (projectIdArray.length === 0) return { query };
    const validProjectIds = projectIdArray
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (validProjectIds.length > 0) {
      query.project = { $in: validProjectIds };
      return { query };
    }
    return {
      error: {
        status: 400,
        body: {
          error: 'Invalid project IDs provided',
          details: 'All provided project IDs are invalid',
        },
      },
    };
  };

  const isValidMaterialForStockRisk = function (material) {
    return (
      material &&
      typeof material.stockAvailable === 'number' &&
      material.stockAvailable > 0 &&
      material.project?._id &&
      material.itemType?._id
    );
  };

  const computeUsageFromUpdateRecords = function (updateRecords, thirtyDaysAgo, now) {
    const records = Array.isArray(updateRecords) ? updateRecords : [];
    let totalUsage = 0;
    const usageByDate = {};
    records.forEach((record) => {
      if (!record?.date) return;
      const recordDate = new Date(record.date);
      if (Number.isNaN(recordDate.getTime())) return;
      if (recordDate < thirtyDaysAgo || recordDate > now) return;
      const dateKey = recordDate.toISOString().split('T')[0];
      const quantityUsed = parseFloat(record.quantityUsed) || 0;
      if (quantityUsed > 0) {
        usageByDate[dateKey] = (usageByDate[dateKey] || 0) + quantityUsed;
        totalUsage += quantityUsed;
      }
    });
    return { totalUsage };
  };

  const computeAverageDailyAndDaysOut = function (material, totalUsage) {
    const daysInPeriod = DAYS_IN_STOCK_RISK_PERIOD;
    let averageDailyUsage = totalUsage > 0 ? totalUsage / daysInPeriod : 0;
    if (averageDailyUsage === 0 && material.stockUsed > 0) {
      averageDailyUsage = parseFloat(material.stockUsed) / daysInPeriod;
    }
    const daysUntilStockOut =
      averageDailyUsage > 0
        ? Math.floor(material.stockAvailable / averageDailyUsage)
        : SENTINEL_NO_USAGE_DATA;
    return { averageDailyUsage, daysUntilStockOut };
  };

  const buildStockOutRiskItem = function (material, averageDailyUsage, daysUntilStockOut) {
    return {
      materialName: material.itemType.name || 'Unknown Material',
      materialId: material.itemType._id.toString(),
      projectId: material.project._id.toString(),
      projectName: material.project.name || 'Unknown Project',
      stockAvailable: parseFloat(material.stockAvailable.toFixed(2)),
      averageDailyUsage: parseFloat(averageDailyUsage.toFixed(2)),
      daysUntilStockOut: Math.max(0, daysUntilStockOut),
      unit: material.itemType.unit || '',
    };
  };

  const getStockOutRiskErrorResponse = function (err) {
    if (err.name === 'CastError' || err.name === 'ValidationError') {
      return { statusCode: 400, errorMessage: 'Invalid request parameters' };
    }
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return { statusCode: 503, errorMessage: 'Database error' };
    }
    return { statusCode: 500, errorMessage: 'Internal Server Error' };
  };

  const bmGetMaterialStockOutRisk = async function (req, res) {
    try {
      const { projectIds } = req.query || {};
      const queryResult = buildStockOutRiskQuery(projectIds);
      if (queryResult.error) {
        return res.status(queryResult.error.status).json(queryResult.error.body);
      }

      const materials = await BuildingMaterial.find(queryResult.query)
        .populate('project', '_id name')
        .populate('itemType', '_id name unit')
        .lean()
        .exec();

      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - DAYS_IN_STOCK_RISK_PERIOD);

      const stockOutRiskData = materials
        .filter((material) => isValidMaterialForStockRisk(material))
        .map((material) => {
          const { totalUsage } = computeUsageFromUpdateRecords(
            material.updateRecord,
            thirtyDaysAgo,
            now,
          );
          const { averageDailyUsage, daysUntilStockOut } = computeAverageDailyAndDaysOut(
            material,
            totalUsage,
          );
          return { material, averageDailyUsage, daysUntilStockOut };
        })
        .filter((x) => x.daysUntilStockOut >= 0 && x.daysUntilStockOut < SENTINEL_NO_USAGE_DATA)
        .map((x) => buildStockOutRiskItem(x.material, x.averageDailyUsage, x.daysUntilStockOut));

      stockOutRiskData.sort((a, b) => {
        const daysA = Number(a.daysUntilStockOut) || 0;
        const daysB = Number(b.daysUntilStockOut) || 0;
        return daysA - daysB;
      });

      res.status(200).json(stockOutRiskData);
    } catch (err) {
      const { statusCode, errorMessage } = getStockOutRiskErrorResponse(err);
      res.status(statusCode).json({ error: errorMessage });
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
    bmGetMaterialStockOutRisk,
  };
};

module.exports = bmMaterialsController;
