const mongoose = require('mongoose');
const {
  uploadFileToAzureBlobStorage,
  deleteBlobFromAzureBlobStorage,
} = require('../../utilities/AzureBlobImages');
const { logException } = require('../../startup/logger');
const {
  ALLOWED_IMAGE_MIME_TYPES,
  INVALID_IMAGE_ERROR,
  IMAGE_NOT_SAVED_ERROR,
} = require('../../middleware/bmEquipmentStatusUpload');

const AZURE_NOT_CONFIGURED_ERROR = 'Image storage is not configured on this server.';

/**
 * Validates the uploaded file's MIME type and uploads it to Azure Blob Storage.
 * Returns { imageUrl } on success, or { error, status } on validation/upload failure.
 *
 * Returns 503 if Azure env vars are not set, so a missing configuration is clearly
 * distinguishable from a runtime upload failure (500).
 */
const validateAndUploadImage = async (file, equipmentId) => {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return { error: INVALID_IMAGE_ERROR, status: 400 };
  }
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING || !process.env.AZURE_STORAGE_CONTAINER_NAME) {
    logException(new Error('Azure Blob Storage env vars are not set'), 'validateAndUploadImage');
    return { error: AZURE_NOT_CONFIGURED_ERROR, status: 503 };
  }
  // Map extension from validated MIME type rather than trusting the
  // client-supplied filename, to avoid extension spoofing.
  const MIME_TO_EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg' };
  const ext = MIME_TO_EXTENSION[file.mimetype] || 'png';
  const safeName = file.originalname
    ? file.originalname.replaceAll(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    : 'image';
  const blobName = `equipment/${equipmentId}/status/${Date.now()}_${safeName}.${ext}`;
  try {
    const imageUrl = await uploadFileToAzureBlobStorage(file, blobName);
    return { imageUrl, blobName };
  } catch (err) {
    logException(err, 'validateAndUploadImage');
    return { error: IMAGE_NOT_SAVED_ERROR, status: 500 };
  }
};

/** Build history from validated fields and the authenticated author, preserving false. */
const buildUpdateRecord = (fields, createdBy, imageUrl) => {
  const record = {
    date: new Date(),
    createdBy: new mongoose.Types.ObjectId(createdBy),
    condition: fields.condition,
  };
  ['lastUsedBy', 'lastUsedFor', 'replacementRequired', 'description', 'notes'].forEach((field) => {
    if (fields[field] !== undefined) record[field] = fields[field];
  });
  if (imageUrl) record.imageUrl = imageUrl;
  return record;
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
    if (!/^[a-f\d]{24}$/i.test(equipmentId || '')) {
      return res.status(400).send({ error: 'Invalid equipment ID.' });
    }
    try {
      const equipment = await BuildingEquipment.findById(equipmentId)
        .populate(equipmentPopulateConfig)
        .exec();
      if (!equipment) return res.status(404).send({ error: 'Equipment not found.' });
      return res.status(200).send(equipment);
    } catch (error) {
      return res.status(500).send({ error: 'Failed to fetch equipment.' });
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

  /**
   * PUT /equipment/:equipmentId/status
   *
   * Appends a new entry to updateRecord[].
   * If a file is included (multipart/form-data), it is uploaded to Azure and its URL is stored
   * in both the new updateRecord entry AND the root imageUrl field (which always reflects the
   * most recently uploaded equipment photo).
   * JSON-only requests (no file) leave root imageUrl unchanged — it continues to show the last
   * photo ever uploaded for this equipment.
   */
  const updateEquipmentStatus = async (req, res) => {
    const { equipmentId } = req.params;
    if (!/^[a-f\d]{24}$/i.test(equipmentId || '')) {
      return res.status(400).send({ error: 'Invalid equipment ID.' });
    }
    // req.user is set by JWT middleware; never trust the client's createdBy.
    const createdBy = req.user?.requestorId;
    if (typeof createdBy !== 'string' || !/^[a-f\d]{24}$/i.test(createdBy)) {
      return res.status(401).send({ error: 'User not authenticated.' });
    }
    const { body } = req;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).send({ error: 'Invalid status payload.' });
    }
    const { condition, replacementRequired, sendNote } = body;
    if (
      typeof condition !== 'string' ||
      !['Good', 'Needs Repair', 'Out of Order'].includes(condition)
    ) {
      return res
        .status(400)
        .send({ error: 'Condition must be Good, Needs Repair, or Out of Order.' });
    }
    const validSelection = (value) =>
      value === undefined || ['', 'yes', 'no', true, false].includes(value);
    if (!validSelection(replacementRequired) || !validSelection(sendNote)) {
      return res
        .status(400)
        .send({ error: 'Replacement and note selections must be yes/no or boolean values.' });
    }
    const textLimits = { lastUsedBy: 200, lastUsedFor: 500, description: 2000, notes: 2000 };
    const invalidText = Object.entries(textLimits).find(
      ([field, limit]) =>
        body[field] !== undefined &&
        body[field] !== null &&
        (typeof body[field] !== 'string' || body[field].length > limit),
    );
    if (invalidText) {
      return res.status(400).send({
        error: `${invalidText[0]} must be a string of at most ${invalidText[1]} characters.`,
      });
    }
    if ((sendNote === 'yes' || sendNote === true) && !body.notes?.trim()) {
      return res.status(400).send({ error: 'Notes are required when sendNote is yes.' });
    }

    try {
      let imageUrl;
      let uploadedBlobName;
      if (req.file) {
        const result = await validateAndUploadImage(req.file, equipmentId);
        if (result.error) {
          return res.status(result.status).send({ error: result.error });
        }
        imageUrl = result.imageUrl;
        uploadedBlobName = result.blobName;
      }

      const updateRecord = buildUpdateRecord(body, createdBy, imageUrl);

      const dbUpdate = { $push: { updateRecord } };
      if (imageUrl) {
        dbUpdate.$set = { imageUrl };
      }

      let updatedEquipment;
      try {
        updatedEquipment = await BuildingEquipment.findByIdAndUpdate(equipmentId, dbUpdate, {
          new: true,
          runValidators: true,
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
      } catch (dbError) {
        // Image already uploaded to Azure but the DB write failed - clean up
        // the now-orphaned blob before surfacing the error.
        if (uploadedBlobName) {
          await deleteBlobFromAzureBlobStorage(uploadedBlobName);
        }
        throw dbError;
      }

      if (!updatedEquipment) {
        if (uploadedBlobName) {
          await deleteBlobFromAzureBlobStorage(uploadedBlobName);
        }
        return res.status(404).send({ error: 'Equipment not found.' });
      }

      return res.status(200).send(updatedEquipment);
    } catch (error) {
      logException(error, 'updateEquipmentStatus');
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        return res.status(400).send({ error: 'Invalid status payload.' });
      }
      return res.status(500).send({
        error: req.file ? IMAGE_NOT_SAVED_ERROR : 'Failed to update equipment status.',
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
