const mongoose = require('mongoose');
const { uploadFileToAzureBlobStorage } = require('../../utilities/AzureBlobImages');
const { logException } = require('../../startup/logger');
const {
  ALLOWED_IMAGE_MIME_TYPES,
  INVALID_IMAGE_ERROR,
  IMAGE_NOT_SAVED_ERROR,
} = require('../../middleware/bmEquipmentStatusUpload');

/**
 * Validates the uploaded file's MIME type and uploads it to Azure Blob Storage.
 * Returns { imageUrl } on success, or { error, status } on validation/upload failure.
 */
const validateAndUploadImage = async (file, equipmentId) => {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return { error: INVALID_IMAGE_ERROR, status: 400 };
  }
  const ext = file.mimetype.split('/')[1];
  const safeName = file.originalname
    ? file.originalname.replaceAll(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    : 'image';
  const blobName = `equipment/${equipmentId}/status/${Date.now()}_${safeName}.${ext}`;
  try {
    const imageUrl = await uploadFileToAzureBlobStorage(file, blobName);
    return { imageUrl };
  } catch (err) {
    logException(err, 'validateAndUploadImage');
    return { error: IMAGE_NOT_SAVED_ERROR, status: 500 };
  }
};

// eslint-disable-next-line max-lines-per-function
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
      logException(error, 'updateMultipleLogRecords');
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
      if (!condition || !createdBy) {
        return res.status(400).send({
          error: 'Condition and createdBy are required fields.',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(createdBy)) {
        logException(new Error('Invalid createdBy ID'), 'updateEquipmentStatus', { createdBy });
        return res.status(400).send({
          error: 'Invalid user ID format. Please log in again.',
          details: `Expected a valid MongoDB ObjectId, got: ${createdBy}`,
        });
      }

      let imageUrl;
      if (req.file) {
        const result = await validateAndUploadImage(req.file, equipmentId);
        if (result.error) {
          return res.status(result.status).send({ error: result.error });
        }
        imageUrl = result.imageUrl;
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
        ...(imageUrl && { imageUrl }),
      };

      const dbUpdate = { $push: { updateRecord } };
      if (imageUrl) {
        dbUpdate.$set = { imageUrl };
      }

      const updatedEquipment = await BuildingEquipment.findByIdAndUpdate(equipmentId, dbUpdate, {
        new: true,
      }).populate([
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

      return res.status(200).send(updatedEquipment);
    } catch (error) {
      logException(error, 'updateEquipmentStatus');
      return res.status(500).send({ error: IMAGE_NOT_SAVED_ERROR });
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
