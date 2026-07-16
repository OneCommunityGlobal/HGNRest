const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  return next();
};

module.exports = function (ResourceRequest, UserProfile, controller) {
  const router = express.Router();

  const ALLOWED_STATUSES = ['pending', 'approved', 'denied'];

  router.post(
    '/educator/resource-requests',
    [
      body('request_title')
        .trim()
        .notEmpty()
        .withMessage('Request title is required')
        .isLength({ max: 200 })
        .withMessage('Request title must be at most 200 characters'),
      body('request_details')
        .trim()
        .notEmpty()
        .withMessage('Request details are required')
        .isLength({ max: 2000 })
        .withMessage('Request details must be at most 2000 characters'),
    ],
    handleValidationErrors,
    controller.createResourceRequest,
  );

  router.get(
    '/educator/resource-requests',
    [query('status').optional().isIn(ALLOWED_STATUSES).withMessage('Invalid status filter')],
    handleValidationErrors,
    controller.getEducatorResourceRequests,
  );

  router.get(
    '/pm/resource-requests',
    [
      query('status').optional().isIn(ALLOWED_STATUSES).withMessage('Invalid status filter'),
      query('educator_id').optional().isMongoId().withMessage('Invalid educator ID'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    ],
    handleValidationErrors,
    controller.getPMResourceRequests,
  );

  router.put(
    '/pm/resource-requests/:id',
    [
      param('id').isMongoId().withMessage('Invalid request ID'),
      body('status').isIn(ALLOWED_STATUSES).withMessage('Invalid status value'),
    ],
    handleValidationErrors,
    controller.updatePMResourceRequestStatus,
  );

  return router;
};
