const express = require('express');
const downloadReportController = require('../../controllers/educationPortal/downloadReportController');
const { hasPermission } = require('../../middleware/permissions');

const downloadReportRouter = express.Router();

/**
 * @route   GET /api/educator/reports/export
 * @desc    Export student or class performance reports in PDF or CSV format
 * @access  Private (Educators, Project Managers, Admins only)
 * @query   type - 'student' or 'class'
 * @query   format - 'pdf' or 'csv'
 * @query   studentId - Required if type is 'student'
 * @query   classId - Required if type is 'class'
 * @query   startDate - Optional filter (ISO date string)
 * @query   endDate - Optional filter (ISO date string)
 */
downloadReportRouter.get(
  '/export',
  hasPermission('educator'),
  downloadReportController.exportReport
);

module.exports = downloadReportRouter;