const multer = require('multer');
const { checkJobApplicationFile } = require('../utilities/jobApplicationFileTypes');

const MB = 1048576;
const MAX_FILE_MB = 5;
const PAYLOAD_TOO_LARGE = 413;

// One resume plus up to five per-question attachments; the JSON payload travels as a text field.
const JOB_APPLICATION_UPLOAD_LIMITS = {
  fileSize: MAX_FILE_MB * MB,
  files: 6,
  fields: 60,
  fieldSize: MB,
  fieldNameSize: 100,
  parts: 66,
};

class UploadRejectedError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'UploadRejectedError';
    this.status = status;
  }
}

const seenFieldsByRequest = new WeakMap();

function jobApplicationFileFilter(req, file, cb) {
  const check = checkJobApplicationFile(file);
  if (!check.ok) {
    cb(new UploadRejectedError(400, check.message));
    return;
  }

  const seen = seenFieldsByRequest.get(req) || new Set();
  if (seen.has(file.fieldname)) {
    cb(new UploadRejectedError(400, 'Each file field may only be sent once.'));
    return;
  }
  seen.add(file.fieldname);
  seenFieldsByRequest.set(req, seen);
  cb(null, true);
}

const jobApplicationUpload = multer({
  storage: multer.memoryStorage(),
  limits: JOB_APPLICATION_UPLOAD_LIMITS,
  fileFilter: jobApplicationFileFilter,
});

const MULTER_ERROR_RESPONSES = {
  LIMIT_FILE_SIZE: [PAYLOAD_TOO_LARGE, 'File too large, max 5 MB.'],
  LIMIT_FIELD_VALUE: [PAYLOAD_TOO_LARGE, 'Form data too large.'],
  LIMIT_FILE_COUNT: [400, 'Too many files, max 6.'],
  LIMIT_FIELD_COUNT: [400, 'Too many form fields.'],
  LIMIT_PART_COUNT: [400, 'Too many form fields.'],
  LIMIT_FIELD_KEY: [400, 'Form field name too long.'],
  LIMIT_UNEXPECTED_FILE: [400, 'Unexpected file field.'],
  MISSING_FIELD_NAME: [400, 'Unexpected file field.'],
};

function describeUploadError(err) {
  if (err instanceof UploadRejectedError) {
    return [err.status, err.message];
  }
  if (err instanceof multer.MulterError) {
    return MULTER_ERROR_RESPONSES[err.code] || [400, 'Invalid file upload.'];
  }
  // Malformed multipart bodies (truncated stream, bad boundary) are client errors too.
  return [400, 'Could not read the uploaded form data.'];
}

/**
 * Parses the multipart body of a job application with size/count limits and a file-type
 * allowlist. Rejections end the request with `{ error }` (400, or 413 for size) instead of
 * falling through to the generic 500 handler.
 */
function jobApplicationUploadMiddleware(req, res, next) {
  jobApplicationUpload.any()(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    const [status, message] = describeUploadError(err);
    res.status(status).json({ error: message });
  });
}

module.exports = {
  JOB_APPLICATION_UPLOAD_LIMITS,
  jobApplicationUpload,
  jobApplicationUploadMiddleware,
};
