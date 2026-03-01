const mongoose = require('mongoose');

const bmEquipmentController = (BuildingEquipment) => {
  const equipmentPopulateConfig = [
    { path: 'itemType', select: '_id name description unit imageUrl category' },
    { path: 'project', select: 'name' },
    { path: 'userResponsible', select: '_id firstName lastName' },
    {
      path: 'purchaseRecord',
      populate: { path: 'requestedBy', select: '_id firstName lastName' },
    },
    {
      path: 'updateRecord',
      populate: { path: 'createdBy', select: '_id firstName lastName' },
    },
    {
      path: 'logRecord',
      populate: [
        { path: 'createdBy', select: '_id firstName lastName' },
        { path: 'responsibleUser', select: '_id firstName lastName' },
      ],
    },
  ];

  const fetchSingleEquipment = async (req, res) => {
    const { equipmentId } = req.params;
    try {
      BuildingEquipment.findById(equipmentId)
        .populate(equipmentPopulateConfig)
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

  const validateEnumField = (value, allowedValues, fieldName) => {
    if (value && !allowedValues.includes(value)) {
      return `Invalid ${fieldName}. Allowed values: ${allowedValues.join(', ')}`;
    }
    return null;
  };

  const updateEquipmentById = async (req, res) => {
    const { equipmentId } = req.params;
    const { projectId, purchaseStatus, currentUsage, condition } = req.body;

    if (!mongoose.Types.ObjectId.isValid(equipmentId)) {
      return res.status(400).send({ message: 'Invalid equipment ID.' });
    }

    if (projectId && !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).send({ message: 'Invalid project ID.' });
    }

    const enumChecks = [
      [purchaseStatus, ['Rental', 'Purchase', 'Needed', 'Purchased', 'Rented'], 'purchaseStatus'],
      [currentUsage, ['Operational', 'Under Maintenance', 'Out of Service'], 'currentUsage'],
      [
        condition,
        [
          'Like New',
          'Good',
          'Worn',
          'Lost',
          'Needs Repair',
          'Needs Replacing',
          'New',
          'Used',
          'Refurbished',
        ],
        'condition',
      ],
    ];
    const validationError = enumChecks.reduce(
      (err, [value, allowed, name]) => err || validateEnumField(value, allowed, name),
      null,
    );
    if (validationError) {
      return res.status(400).send({ message: validationError });
    }

    try {
      const updateFields = {};
      const fieldMap = {
        projectId: 'project',
        equipmentClass: 'equipmentClass',
        purchaseStatus: 'purchaseStatus',
        currentUsage: 'currentUsage',
        condition: 'condition',
      };
      Object.entries(fieldMap).forEach(([bodyKey, schemaKey]) => {
        const val = req.body[bodyKey];
        if (val !== undefined && val !== null) {
          updateFields[schemaKey] = val;
        }
      });

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).send({ message: 'No valid fields provided to update.' });
      }

      await BuildingEquipment.updateOne({ _id: equipmentId }, { $set: updateFields });

      const updatedEquipment = await BuildingEquipment.findById(equipmentId)
        .populate(equipmentPopulateConfig)
        .exec();

      if (!updatedEquipment) {
        return res.status(404).send({ message: 'Equipment not found.' });
      }

      return res.status(200).send(updatedEquipment);
    } catch (error) {
      return res.status(500).send({ message: error.message || 'Internal server error.' });
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

  const updateEquipmentStatus = async (req, res) => {
    const { equipmentId } = req.params;
    const {
      condition,
      lastUsedBy,
      lastUsedFor,
      replacementRequired,
      description,
      notes,
      createdBy,
    } = req.body;

    try {
      // Validate required fields
      if (!condition || !createdBy) {
        return res.status(400).send({
          error: 'Condition and createdBy are required fields.',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(createdBy)) {
        console.error('Invalid createdBy ID:', createdBy);
        return res.status(400).send({
          error: 'Invalid user ID format. Please log in again.',
          details: `Expected a valid MongoDB ObjectId, got: ${createdBy}`,
        });
      }

      const updateRecord = {
        date: new Date(),
        createdBy: new mongoose.Types.ObjectId(createdBy),
        condition,
        lastUsedBy: lastUsedBy || '',
        lastUsedFor: lastUsedFor || '',
        replacementRequired: replacementRequired || '',
        description: description || '',
        notes: notes || '',
      };

      console.log('Adding update record:', updateRecord);

      // Update the equipment with new status
      const updatedEquipment = await BuildingEquipment.findByIdAndUpdate(
        equipmentId,
        {
          $push: {
            updateRecord,
          },
        },
        { new: true },
      ).populate([
        {
          path: 'itemType',
          select: '_id name description unit imageUrl category',
        },
        {
          path: 'project',
          select: 'name',
        },
        {
          path: 'updateRecord.createdBy',
          select: '_id firstName lastName',
        },
      ]);

      if (!updatedEquipment) {
        return res.status(404).send({ error: 'Equipment not found.' });
      }

      res.status(200).send(updatedEquipment);
    } catch (error) {
      console.error('[updateEquipmentStatus] ', error);
      res.status(500).send({
        error: 'Failed to update equipment status',
        details: error.message,
      });
    }
  };

  return {
    fetchSingleEquipment,
    bmPurchaseEquipments,
    fetchBMEquipments,
    updateEquipmentById,
    updateLogRecords,
    updateEquipmentStatus,
  };
};

module.exports = bmEquipmentController;
