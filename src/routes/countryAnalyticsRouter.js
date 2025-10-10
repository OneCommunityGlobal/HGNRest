const express = require('express');
const countryAnalyticsController = require('../controllers/countryAnalyticsController');

const router = express.Router();

/**
 * @route GET /api/analytics/country-applications
 * @desc Get country application data for map visualization
 * @query {string} filter - Time filter: weekly, monthly, yearly (default: weekly)
 * @query {string} startDate - Custom start date (ISO format)
 * @query {string} endDate - Custom end date (ISO format)
 * @query {string} roles - Comma-separated list of roles to filter by
 * @returns {Object} Country application data with counts and percentage changes
 */
router.get('/country-applications', countryAnalyticsController.getCountryApplications);

/**
 * @route GET /api/analytics/roles
 * @desc Get list of all available roles from the database
 * @returns {Object} List of unique role names
 */
router.get('/roles', countryAnalyticsController.getAvailableRoles);

module.exports = router;
