const mongoose = require('mongoose');

const bmConsumableController = function (BuildingConsumable) {
  const fetchBMConsumables = async (req, res) => {
    try {
      BuildingConsumable.find()
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
        .then((result) => {
          res.status(200).send(result);
        })
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  const bmPurchaseConsumables = async function (req, res) {
    const {
      projectId,
      consumableId,
      quantity,
      priority,
      brand: brandPref,
      requestor: { requestorId },
    } = req.body;
    const newPurchaseRecord = {
      quantity,
      priority,
      brandPref,
      requestedBy: requestorId,
    };
    try {
      const doc = await BuildingConsumable.findOne({ project: projectId, itemType: consumableId });
      if (!doc) {
        const newDoc = {
          itemType: consumableId,
          project: projectId,
          purchaseRecord: [newPurchaseRecord],
        };
        BuildingConsumable.create(newDoc)
          .then(() => res.status(201).send())
          .catch((error) => res.status(500).send(error));
        return;
      }
      BuildingConsumable.findOneAndUpdate(
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

  const bmPostConsumableUpdateRecord = function (req, res) {
    const {
      quantityUsed,
      quantityWasted,
      qtyUsedLogUnit,
      qtyWastedLogUnit,
      stockAvailable,
      consumable,
    } = req.body;
    let unitsUsed = quantityUsed;
    let unitsWasted = quantityWasted;

    if (quantityUsed >= 0 && qtyUsedLogUnit === 'percent') {
      unitsUsed = (stockAvailable / 100) * quantityUsed;
    }
    if (quantityWasted >= 0 && qtyWastedLogUnit === 'percent') {
      unitsWasted = (stockAvailable / 100) * quantityWasted;
    }
    if (
      unitsUsed > stockAvailable ||
      unitsWasted > stockAvailable ||
      unitsUsed + unitsWasted > stockAvailable
    ) {
      return res.status(500).send({
        message:
          'Please check the used and wasted stock values. Either individual values or their sum exceeds the total stock available.',
      });
    }
    if (unitsUsed < 0 || unitsWasted < 0) {
      return res.status(500).send({
        message: 'Please check the used and wasted stock values. Negative numbers are invalid.',
      });
    }

    const newStockUsed = parseFloat((consumable.stockUsed + unitsUsed).toFixed(4));
    const newStockWasted = parseFloat((consumable.stockWasted + unitsWasted).toFixed(4));
    const newAvailable = parseFloat((stockAvailable - (unitsUsed + unitsWasted)).toFixed(4));

    BuildingConsumable.updateOne(
      { _id: consumable._id },
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
            quantityUsed: unitsUsed,
            quantityWasted: unitsWasted,
          },
        },
      },
    )
      .then((results) => {
        res.status(200).send(results);
      })
      .catch((error) => {
        console.log('error: ', error);
        res.status(500).send({ message: error });
      });
  };

  return {
    fetchBMConsumables,
    bmPurchaseConsumables,
    bmPostConsumableUpdateRecord,
  };
};

module.exports = bmConsumableController;
