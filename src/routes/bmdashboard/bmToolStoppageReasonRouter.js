const express = require('express');
const { query, param, validationResult } = require('express-validator');

const routes = function (ToolStoppageReason) {
  const bmToolStoppageReasonRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmToolStoppageReasonController')(
    ToolStoppageReason,
  );

  // Validation middleware
  const validateToolStoppageReasonQuery = [
    param('id').isMongoId().withMessage('Project ID must be a valid MongoDB ObjectId'),
    query('startDate')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T.*/)
      .withMessage('startDate must be in YYYY-MM-DD or ISO 8601 format'),
    query('endDate')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T.*/)
      .withMessage('endDate must be in YYYY-MM-DD or ISO 8601 format'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
          message: 'Validation failed',
        });
      }
      next();
    },
  ];

  // GET /api/bm/projects/:id/tools-stoppage-reason
  bmToolStoppageReasonRouter
    .route('/bm/projects/:id/tools-stoppage-reason')
    .get(validateToolStoppageReasonQuery, controller.getToolsStoppageReason);

  // GET /api/bm/tools-stoppage-reason/projects
  bmToolStoppageReasonRouter
    .route('/bm/tools-stoppage-reason/projects')
    .get(controller.getUniqueProjectIds);

  return bmToolStoppageReasonRouter;
};

module.exports = routes;
