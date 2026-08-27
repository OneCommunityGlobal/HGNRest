const crypto = require('crypto');
const fs = require('fs').promises;
const os = require('os');
const express = require('express');
const multer = require('multer');
const {
  connectYoutubeAccount,
  getYoutubeAuthorizationUrl,
  getYoutubeConnectionStatus,
  uploadVideo,
} = require('../controllers/youtubeAutoPoster');

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
      callback(error);
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
    // Upload responses should not fail only because temporary-file cleanup failed.
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

router.get('/auth-url', getYoutubeAuthorizationUrl);
router.get('/status', getYoutubeConnectionStatus);
router.post('/connect', connectYoutubeAccount);
router.post('/upload', upload.single('video'), handleUpload);

router.use((error, _req, res, next) => {
  if (!error) return next();

  if (error instanceof multer.MulterError) {
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
