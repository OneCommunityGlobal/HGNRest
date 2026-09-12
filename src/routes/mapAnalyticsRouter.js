const express = require('express');
const mapAnalyticsController = require('../controllers/mapAnalyticsController');

const router = express.Router();

/**
 * @route GET /api/map-analytics/data
 * @desc Get map analytics data for job applications by country
 * @query {string} filter - Time filter: weekly, monthly, yearly
 * @query {string} startDate - Custom start date (ISO format)
 * @query {string} endDate - Custom end date (ISO format)
 * @query {string} roles - Comma-separated list of roles to filter by
 * @query {boolean} includeMetadata - Include additional metadata (default: false)
 * @query {boolean} groupByRegion - Group data by region instead of country (default: false)
 * @returns {Object} Map analytics data with country/region counts
 */
router.get('/data', mapAnalyticsController.getMapData);

/**
 * @route GET /api/map-analytics/comparison
 * @desc Get comparison data showing percentage changes between time periods
 * @query {string} filter - Time filter: weekly, monthly, yearly (required)
 * @query {string} roles - Comma-separated list of roles to filter by
 * @returns {Object} Comparison data with percentage changes
 * @note Does not work with custom date ranges
 */
router.get('/comparison', mapAnalyticsController.getComparisonData);

/**
 * @route GET /api/map-analytics/roles
 * @desc Get list of available roles for filtering
 * @returns {Object} List of available roles
 */
router.get('/roles', mapAnalyticsController.getAvailableRoles);

/**
 * @route GET /api/map-analytics/role-statistics
 * @desc Get role statistics for the selected time period
 * @query {string} filter - Time filter: weekly, monthly, yearly
 * @query {string} startDate - Custom start date (ISO format)
 * @query {string} endDate - Custom end date (ISO format)
 * @returns {Object} Role statistics with counts and country distribution
 */
router.get('/role-statistics', mapAnalyticsController.getRoleStatistics);

/**
 * @route GET /api/map-analytics/dashboard
 * @desc Get comprehensive dashboard data combining map, comparison, and role statistics
 * @query {string} filter - Time filter: weekly, monthly, yearly
 * @query {string} startDate - Custom start date (ISO format)
 * @query {string} endDate - Custom end date (ISO format)
 * @query {string} roles - Comma-separated list of roles to filter by
 * @query {boolean} includeComparison - Include comparison data (default: true)
 * @returns {Object} Complete dashboard data
 */
router.get('/dashboard', mapAnalyticsController.getDashboardData);

/**
 * @route GET /api/map-analytics/country/:country
 * @desc Get detailed analytics for a specific country
 * @param {string} country - 3-letter ISO country code
 * @query {string} filter - Time filter: weekly, monthly, yearly
 * @query {string} startDate - Custom start date (ISO format)
 * @query {string} endDate - Custom end date (ISO format)
 * @query {string} roles - Comma-separated list of roles to filter by
 * @returns {Object} Detailed country analytics
 */
router.get('/country/:country', mapAnalyticsController.getCountryDetails);

module.exports = router;
