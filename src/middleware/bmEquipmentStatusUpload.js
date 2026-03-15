const multer = require('multer');

// eslint-disable-next-line no-magic-numbers
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];
const INVALID_IMAGE_ERROR = 'Invalid image. Use PNG, JPG, or JPEG under 5MB.';
const IMAGE_NOT_SAVED_ERROR = 'Image selected but not saved.';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES }, // NOSONAR S5693 - 5 MB is intentional for equipment image uploads; within the ≤8 MB guidance for file uploads
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(INVALID_IMAGE_ERROR), false);
    }
  },
});

/**
 * Conditionally applies multer for multipart/form-data requests only.
 * JSON requests pass through unchanged (req.file remains undefined).
 * Returns 400 on any multer error (file too large, wrong MIME type).
 */
const bmEquipmentStatusUpload = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return next();
  }
  return upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).send({ error: INVALID_IMAGE_ERROR });
    }
    return next();
  });
};

module.exports = {
  bmEquipmentStatusUpload,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  INVALID_IMAGE_ERROR,
  IMAGE_NOT_SAVED_ERROR,
};
