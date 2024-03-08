const mongoose = require('mongoose');

const bmConsumableController = function (BuildingConsumable) {
  const fetchBMConsumables = async (req, res) => {
    try {
      BuildingConsumable
        .find()
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
        .then(result => {
          res.status(200).send(result);
        })
        .catch(error => res.status(500).send(error));
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
      brand : brandPref,
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
        BuildingConsumable
          .create(newDoc)
          .then(() => res.status(201).send())
          .catch(error => res.status(500).send(error));
        return;
      }
      BuildingConsumable
        .findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(doc._id) },
          { $push: { purchaseRecord: newPurchaseRecord } },
        )
        .exec()
        .then(() => res.status(201).send())
        .catch(error => res.status(500).send(error));
      } catch (error) {
      res.status(500).send(error);
    }
  };

  return {
    fetchBMConsumables,
    bmPurchaseConsumables,
  };
};

module.exports = bmConsumableController;
