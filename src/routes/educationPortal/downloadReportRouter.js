const express = require('express');
const downloadReportController = require('../../controllers/educationPortal/downloadReportController');
const { hasPermission } = require('../../middleware/permissions');

const downloadReportRouter = express.Router();

/**
 * @route   GET /api/educator/reports/export
 * @desc    Export student or class performance reports in PDF or CSV format
 * @access  Private (Educators, Project Managers, Admins only)
 * @query   type - 'student' or 'class' (required)
 * @query   format - 'pdf' or 'csv' (required)
 * @query   studentId - Required if type is 'student'
 * @query   classId - Required if type is 'class'
 * @query   startDate - Optional filter (ISO date string, e.g., '2025-01-01')
 * @query   endDate - Optional filter (ISO date string, e.g., '2025-12-31')
 * @returns PDF or CSV file download
 * 
 * @example Student Report PDF:
 * GET /api/educator/reports/export?type=student&format=pdf&studentId=507f1f77bcf86cd799439011&startDate=2025-01-01&endDate=2025-12-31
 * 
 * @example Class Report CSV:
 * GET /api/educator/reports/export?type=class&format=csv&classId=507f1f77bcf86cd799439012
 */
downloadReportRouter.get(
  '/export',
  hasPermission('educator'),
  downloadReportController.exportReport
);

module.exports = downloadReportRouter;