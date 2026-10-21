const express = require('express');
const multer = require('multer');
const { hasPermission } = require('../utilities/permissions');

/**
 * Middleware to check permissions for Imgur posting
 * Uses the same permission as announcements/emails
 */
async function requireImgurPostingPermission(req, res, next) {
  try {
    const userId = req.user?._id || req.body?.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Check if user has permission to send announcements (same as emails)
    if (await hasPermission(userId, 'sendEmails')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'You are not authorized to post to Imgur.',
    });
  } catch (err) {
    console.error('Imgur permission check failed:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check permissions.',
    });
  }
}

const routes = () => {
  // Configure multer for image uploads
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // Reduced to 10MB max file size to prevent DoS via large payloads (S5693 fix)
      files: 10, // Maximum 10 images per post
    },
    fileFilter: (req, file, cb) => {
      // Only allow image files
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`));
      }
    },
  });

  const controller = require('../controllers/imgurPostController')();
  const imgurRouter = express.Router();

  /**
   * Error handling middleware for multer
   */
  function handleMulterErrors(err, req, res, next) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the limit of 100MB',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 10 files allowed.',
        });
      }
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  }

  // =========================================================================
  // ROUTES
  // =========================================================================

  /**
   * POST /imgur/post
   * Post to Imgur immediately or schedule for later
   *
   * Request body:
   * {
   *   title: string (required),
   *   description: string (optional),
   *   scheduleTime: ISO DateTime string (optional - if provided, post is scheduled)
   * }
   *
   * Files: Up to 10 image files
   */
  imgurRouter.post(
    '/imgur/post',
    upload.array('images', 10),
    handleMulterErrors,
    requireImgurPostingPermission,
    controller.postToImgur,
  );

  /**
   * GET /imgur/posts
   * Get all scheduled posts for the current user
   *
   * Query params:
   * - userId: optional, filter by specific user (if authorized)
   */
  imgurRouter.get('/imgur/posts', requireImgurPostingPermission, controller.getScheduledPosts);

  /**
   * DELETE /imgur/posts/:postId
   * Delete a scheduled post
   *
   * Only pending posts can be deleted
   */
  imgurRouter.delete(
    '/imgur/posts/:postId',
    requireImgurPostingPermission,
    controller.deleteScheduledPost,
  );

  /**
   * PUT /imgur/posts/:postId
   * Update a scheduled post
   *
   * Request body:
   * {
   *   title: string (optional),
   *   description: string (optional),
   *   scheduleTime: ISO DateTime string (optional)
   * }
   *
   * Files: Up to 10 updated image files (replaces existing images)
   */
  imgurRouter.put(
    '/imgur/posts/:postId',
    upload.array('images', 10),
    handleMulterErrors,
    requireImgurPostingPermission,
    controller.updateScheduledPost,
  );

  /**
   * POST /imgur/authorize
   * Handle Imgur OAuth authorization
   * This endpoint may not require the same permission level as posting
   *
   * Request body:
   * {
   *   code: string (authorization code from Imgur OAuth flow)
   * }
   */
  imgurRouter.post('/imgur/authorize', controller.authorizeImgur);

  return imgurRouter;
};

module.exports = routes;
