const mongoose = require('mongoose');

const bmEquipmentController = (BuildingEquipment) => {
  const fetchSingleEquipment = async (req, res) => {
    const { equipmentId } = req.params;
    try {
      BuildingEquipment.findById(equipmentId)
        .populate([
          {
            path: 'itemType',
            select: '_id name description unit imageUrl category',
          },
          {
            path: 'project',
            select: 'name',
          },
          {
            path: 'userResponsible',
            select: '_id firstName lastName',
          },
          {
            path: 'purchaseRecord',
            populate: {
              path: 'requestedBy',
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
          console.log("Record found");
        })
        .catch(error => res.status(500).send(error));
            path: 'updateRecord',
            populate: [
              path: 'createdBy',
              select: '_id firstName lastName',
            },
          ],
          {
            path: 'logRecord',
            populate: [
              {
                path: 'createdBy',
                select: '_id firstName lastName',
              },
              {
                path: 'responsibleUser',
                select: '_id firstName lastName',
              },
            ],
          },
        ])
        .exec()
        .then((equipment) => res.status(200).send(equipment))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };
  const bmPurchaseEquipments = async function (req, res) {
    const {
      projectId,
      equipmentId,
      quantity,
      priority,
      estTime: estUsageTime,
      desc: usageDesc,
      makeModel: makeModelPref,
      requestor: { requestorId },
    } = req.body;
    try {
      const newPurchaseRecord = {
        quantity,
        priority,
        estUsageTime,
        usageDesc,
        makeModelPref,
        requestedBy: requestorId,
      };
      const doc = await BuildingEquipment.findOne({ project: projectId, itemType: equipmentId });
      if (!doc) {
        const newDoc = {
          itemType: equipmentId,
          project: projectId,
          purchaseRecord: [newPurchaseRecord],
        };

        BuildingEquipment.create(newDoc)
          .then(() => res.status(201).send())
          .catch((error) => res.status(500).send(error));
        return;
      }

      BuildingEquipment.findOneAndUpdate(
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

  return {
    fetchSingleEquipment,
    bmPurchaseEquipments,
  };
};

module.exports = bmEquipmentController;
