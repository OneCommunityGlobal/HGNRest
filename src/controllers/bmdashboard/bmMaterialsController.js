const mongoose = require('mongoose')

const bmMaterialsController = function (ItemMaterial) {
  const bmMaterialsList = async function _matsList(req, res) {
    try {
      ItemMaterial.find()
      .populate([
        {
          path: 'project',
          select: '_id projectName'
        },
        {
          path: 'inventoryItemType',
          select: '_id name uom totalStock totalAvailable'
        },
        {
          path: 'usageRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName'
          }
        },
        {
          path: 'updateRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName'
          }
        },
        {
          path: 'purchaseRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName'
          }
        }
      ])
      .exec()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(500).send(error))
    } catch (err) {
      res.json(err);
    }
  };
  const bmGetMaterialsListByProjectIdAndCheckInOut = function (req, res) {
    const projectId = mongoose.Types.ObjectId(req.query.projectId);
    const checkIn = req.query.checkInOut;
    let stockVariable = 'stockUsed'; // Check In
    if (checkIn == 0) // Check Out
    {
      stockVariable = 'stockAvailable';
    }
    try {
      ItemMaterial.find({ project: projectId, [stockVariable]: { $gte: 1 } })
      .populate([
        {
          path: 'inventoryItemType',
          select: '_id name uom',
          match: { type: 'material' },
        },
      ])
      .select({
 stockBought: 1, stockUsed: 1, stockAvailable: 1, stockHeld: 1, stockWasted: 1,
})
      .then((results) => {
        res.status(200).send(results);
})
      .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };
  const bmPostMaterialLog = function (req, res) {
    const { materialLogs } = req.body.payload;
    const logDate = req.body.payload.date;
    const usageRecordsToBeAdded = Object.values(materialLogs).map(material => ({
        updateId: material._id,
        updateValue: {
          createdBy: req.body.requestor.requestorId,
          quantityUsed: material.logValue,
          date: logDate,
        },
      }));
    try {
    const updatePromises = usageRecordsToBeAdded.map(updateItem => ItemMaterial.updateOne(
        { _id: updateItem.updateId },
        { $push: { usageRecord: updateItem.updateValue } },
      ).exec());
    Promise.all(updatePromises)
    .then((results) => {
      res.status(200).send({ result: `Successfully posted log for ${results.length} Material records.` });
    })
    .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };
  return { 
    bmMaterialsList ,  
    bmGetMaterialsListByProjectIdAndCheckInOut,
    bmPostMaterialLog, };
};

module.exports = bmMaterialsController;