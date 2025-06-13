// Bluesky Router
const express = require('express');
const multer = require('multer');
const blueskyController = require('../controllers/blueskyController');

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024, // 1MB limit for images
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'), false);
      return;
    }

    // Reject GIF files temporarily
    if (file.mimetype === 'image/gif') {
      cb(new Error('GIF files are temporarily not supported'), false);
      return;
    }

    // Log file info
    console.log('[Bluesky] Uploading file:', {
      mimetype: file.mimetype,
      size: req.headers['content-length'],
    });

    cb(null, true);
  },
});

// Authentication routes
router.post('/connect', blueskyController.connect);
router.post('/disconnect', blueskyController.disconnect);

// Session management
router.get('/session', blueskyController.checkSession);

// Post management routes
router.post('/post', upload.single('image'), blueskyController.createPost);
router.get('/posts', blueskyController.getPosts);
router.delete('/post/:uri', blueskyController.deletePost);

// Error handling middleware
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: 'Image upload failed: ' + err.message,
    });
  }

  if (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }

  next();
});

module.exports = router;
