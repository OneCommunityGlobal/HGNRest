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
            path: 'updateRecord',
            populate: {
              path: 'createdBy',
              select: '_id firstName lastName',
            },
          },
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

  const fetchBMEquipments = async (req, res) => {
    try {
      const { project: projectId } = req.query;

      const mongoFilter = projectId ? { project: projectId } : {};
      BuildingEquipment.find(mongoFilter)
        .populate([
          {
            path: 'project',
            select: '_id name',
          },
          {
            path: 'itemType',
            select: '_id name',
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

  const updateLogRecords = async (req, res) => {
    const { project: projectId } = req.query;
    const updates = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).send({ error: 'Request body must be a non-empty array.' });
    }

    const invalid = updates.some((item) => {
      if (!item.equipmentId || !mongoose.Types.ObjectId.isValid(item.equipmentId)) {
        res.status(400).send({ error: 'Invalid or missing equipmentId.' });
        return true;
      }
      const { createdBy, type } = item.logEntry || {};
      if (!createdBy || !type) {
        res.status(400).send({
          error: 'Each logEntry must include "createdBy" and "type".',
        });
        return true;
      }
      return false;
    });

    if (invalid) return;

    try {
      await Promise.all(
        updates.map(({ equipmentId, logEntry }) => {
          const logDocument = {
            date: logEntry.date || Date.now(),
            createdBy: logEntry.createdBy,
            responsibleUser: logEntry.responsibleUser || null,
            type: logEntry.type,
            quantity: logEntry.quantity || 1,
          };

          return BuildingEquipment.findByIdAndUpdate(
            equipmentId,
            { $push: { logRecord: logDocument } },
            { new: false },
          ).exec();
        }),
      );

      const queryFilter = projectId ? { project: projectId } : {};

      const equipmentList = await BuildingEquipment.find(queryFilter)
        .populate([
          { path: 'project', select: '_id name' },
          { path: 'itemType', select: '_id name' },
          {
            path: 'logRecord',
            populate: [
              { path: 'createdBy', select: '_id firstName lastName' },
              { path: 'responsibleUser', select: '_id firstName lastName' },
            ],
          },
          {
            path: 'purchaseRecord',
            populate: {
              path: 'requestedBy',
              select: '_id firstName lastName',
            },
          },
        ])
        .exec();

      return res.status(200).send(equipmentList);
    } catch (error) {
      console.error('[updateMultipleLogRecords] ', error);
      return res.status(500).send(error);
    }
  };

  return {
    fetchSingleEquipment,
    bmPurchaseEquipments,
    fetchBMEquipments,
    updateLogRecords,
  };
};

module.exports = bmEquipmentController;
