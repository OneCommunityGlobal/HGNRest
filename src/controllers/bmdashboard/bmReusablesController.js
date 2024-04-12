const mongoose = require('mongoose');

const bmReusablesController = function (BuildingReusable) {
  const bmReusablesList = async function _reusableslist(req, res) {
    try {
      BuildingReusable.find()
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
            select: '_id firstName lastName',
          },
        },
        {
          path: 'purchaseRecord',
          populate: {
            path: 'requestedBy',
            select: '_id firstName lastName',
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

  const bmPurchaseReusables = async function (req, res) {
    const {
      projectId,
      reusTypeId,
      quantity,
      priority,
      brand: brandPref,
      requestor: { requestorId },
    } = req.body;
    try {
      const newPurchaseRecord = {
        quantity,
        priority,
        brandPref,
        requestedBy: requestorId,
      };
      const doc = await BuildingReusable.findOne({ project: projectId, itemType: reusTypeId });
      if (!doc) {
        const newDoc = {
          itemType: reusTypeId,
          project: projectId,
          purchaseRecord: [newPurchaseRecord],
        };
      BuildingReusable
      .create(newDoc)
      .then(() => res.status(201).send())
      .catch((error) => res.status(500).send(error));
      return;
      }
      BuildingReusable
        .findOneAndUpdate(
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

  const bmPostReusableUpdateRecord = function (req, res) {
    const payload = req.body;
    let quantityUsed = +req.body.quantityUsed;
    let quantityWasted = +req.body.quantityWasted;
    const { reusable } = req.body;
    if (payload.QtyUsedLogUnit == 'percent' && quantityWasted >= 0) {
        quantityUsed = +((+quantityUsed / 100) * reusable.stockAvailable).toFixed(4);
      }
      if (payload.QtyWastedLogUnit == 'percent' && quantityUsed >= 0) {
        quantityWasted = +((+quantityWasted / 100) * reusable.stockAvailable).toFixed(4);
      }

    if (quantityUsed > reusable.stockAvailable || quantityWasted > reusable.stockAvailable || (quantityUsed + quantityWasted) > reusable.stockAvailable) {
      res.status(500).send('Please check the used and wasted stock values. Either individual values or their sum exceeds the total stock available.');
    } else {
    let newStockUsed = +reusable.stockUsed + parseFloat(quantityUsed);
    let newStockWasted = +reusable.stockWasted + parseFloat(quantityWasted);
    let newAvailable = +reusable.stockAvailable - parseFloat(quantityUsed) - parseFloat(quantityWasted);
    newStockUsed = parseFloat(newStockUsed.toFixed(4));
    newStockWasted = parseFloat(newStockWasted.toFixed(4));
    newAvailable = parseFloat(newAvailable.toFixed(4));
    BuildingReusable.updateOne(
        { _id: req.body.reusable._id },

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
        .then((results) => { res.status(200).send(results); })
        .catch((error) => res.status(500).send({ message: error }));
   }
  };

  const bmPostReusableUpdateBulk = function (req, res) {
    console.log("Inside Reusable Update Bulk");
    const reusableUpdates = req.body.upadateReusables;
    let errorFlag = false;
    const updateRecordsToBeAdded = [];
    for (let i = 0; i < reusableUpdates.length; i++) {
      const payload = reusableUpdates[i];
      let quantityUsed = +payload.quantityUsed;
      let quantityWasted = +payload.quantityWasted;
      const { reusable } = payload;
      if (payload.QtyUsedLogUnit == 'percent' && quantityWasted >= 0) {
        quantityUsed = +((+quantityUsed / 100) * reusable.stockAvailable).toFixed(4);
      }
      if (payload.QtyWastedLogUnit == 'percent' && quantityUsed >= 0) {
        quantityWasted = +((+quantityWasted / 100) * reusable.stockAvailable).toFixed(4);
      }

      let newStockUsed = +reusable.stockUsed + parseFloat(quantityUsed);
      let newStockWasted = +reusable.stockWasted + parseFloat(quantityWasted);
      let newAvailable = +reusable.stockAvailable - parseFloat(quantityUsed) - parseFloat(quantityWasted);
      newStockUsed = parseFloat(newStockUsed.toFixed(4));
      newStockWasted = parseFloat(newStockWasted.toFixed(4));
      newAvailable = parseFloat(newAvailable.toFixed(4));
      if (newAvailable < 0) {
        errorFlag = true;
        break;
      }
      updateRecordsToBeAdded.push({
        updateId: reusable._id,
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
    const updatePromises = updateRecordsToBeAdded.map((updateItem) => BuildingReusable.updateOne(
        { _id: updateItem.updateId },
        {
          $set: updateItem.set,
          $push: { updateRecord: updateItem.updateValue },
        },
      ).exec());
    Promise.all(updatePromises)
    .then((results) => {
      res.status(200).send({ result: `Successfully posted log for ${results.length} Reusable records.` });
    })
    .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };
  return {
    bmReusablesList,
    bmPostReusableUpdateRecord,
    bmPostReusableUpdateBulk,
    bmPurchaseReusables,
};
};

module.exports = bmReusablesController;
