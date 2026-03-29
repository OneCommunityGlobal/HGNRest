/* istanbul ignore file */
const express = require('express');
const downloadReportController = require('../../controllers/educationPortal/downloadReportController');

const downloadReportRouter = express.Router();

/**
 * @route   GET /api/educator/reports/export
 * @desc    Export student or class performance reports in PDF or CSV format
 * @access  Private (Educators, Project Managers, Admins only)
 * Note: Authorization is handled within the controller
 */
downloadReportRouter.get('/export', downloadReportController.exportReport);

module.exports = downloadReportRouter;
