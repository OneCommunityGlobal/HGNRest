const crypto = require('node:crypto');
const fs = require('node:fs').promises;
const os = require('node:os');
const express = require('express');
const multer = require('multer');
const {
  connectYoutubeAccount,
  disconnectYoutubeAccount,
  getYoutubeAuthorizationUrl,
  getYoutubeCategories,
  getYoutubeConnectionStatus,
  uploadVideo,
} = require('../controllers/youtubeAutoPoster');
const { attachYoutubeRequestor } = require('../middleware/attachYoutubeRequestor');
const { requireYoutubePermission } = require('../middleware/youtubePermissionMiddleware');

const BYTES_PER_KIBIBYTE = 1024;
const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const BYTES_PER_GIBIBYTE = BYTES_PER_MEBIBYTE * BYTES_PER_KIBIBYTE;
const DEFAULT_MAX_UPLOAD_BYTES = 2 * BYTES_PER_GIBIBYTE;
const HTTP_PAYLOAD_TOO_LARGE = 413;

const configuredMaxUploadBytes = Number(process.env.YOUTUBE_MAX_UPLOAD_BYTES);
const maxUploadBytes =
  Number.isFinite(configuredMaxUploadBytes) && configuredMaxUploadBytes > 0
    ? configuredMaxUploadBytes
    : DEFAULT_MAX_UPLOAD_BYTES;

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, os.tmpdir()),
  filename: (_req, _file, callback) => callback(null, `youtube-${crypto.randomUUID()}`),
});

const upload = multer({
  storage,
  limits: {
    files: 1,
    fileSize: maxUploadBytes,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype?.startsWith('video/')) {
      const error = new Error('video must be a supported video file');
      error.statusCode = 400;
      callback(error, false);
      return;
    }
    callback(null, true);
  },
});

const removeTemporaryFile = async (file) => {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    // Upload responses should not fail solely because temporary-file cleanup failed.
    // eslint-disable-next-line no-console
    console.error(`Failed to remove temporary YouTube upload ${file.path}:`, error.message);
  }
};

const handleUpload = async (req, res, next) => {
  try {
    await uploadVideo(req, res);
  } catch (error) {
    next(error);
  } finally {
    await removeTemporaryFile(req.file);
  }
};

const router = express.Router();

// Public: Google redirects the browser here; protected by the OAuth state stored in the session
router.get('/callback', connectYoutubeAccount);

// Authenticated endpoints: the JWT sets req.requestor (these routes sit before global auth)
router.get('/auth-url', attachYoutubeRequestor, getYoutubeAuthorizationUrl);
router.get('/status', attachYoutubeRequestor, getYoutubeConnectionStatus);
router.get('/categories', attachYoutubeRequestor, getYoutubeCategories);
router.post('/disconnect', attachYoutubeRequestor, disconnectYoutubeAccount);

// Permission check BEFORE file upload middleware
router.post(
  '/upload',
  attachYoutubeRequestor,
  requireYoutubePermission,
  upload.single('video'),
  handleUpload,
);

router.use((error, _req, res, next) => {
  if (!error) return next();

  const isMulterError =
    error instanceof multer.MulterError ||
    error.name === 'MulterError' ||
    (error.code && error.code.startsWith('LIMIT_'));

  if (isMulterError) {
    const statusCode = error.code === 'LIMIT_FILE_SIZE' ? HTTP_PAYLOAD_TOO_LARGE : 400;
    return res.status(statusCode).json({
      success: false,
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? `video must not exceed ${maxUploadBytes} bytes`
          : error.message,
    });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Failed to receive YouTube upload',
  });
});

module.exports = router;
