// summaryDashboard.controller.js
const service = require('../services/summaryDashboard.service');
const logger = require('../startup/logger');

// Valid metric names for validation
const validMetrics = [
  'totalProjects',
  'completedProjects',
  'delayedProjects',
  'activeProjects',
  'avgProjectDuration',
  'totalMaterialCost',
  'totalLaborCost',
  'totalMaterialUsed',
  'materialWasted',
  'materialAvailable',
  'materialUsed',
  'totalLaborHours',
];

// Get latest metrics snapshot
exports.getMetrics = async (req, res) => {
  try {
    const snapshot = await service.getAllMetrics();
    // Note: getAllMetrics now auto-generates, so snapshot should never be null
    if (!snapshot) {
      const trackingId = logger.logException(
        new Error('Failed to generate or retrieve metrics'),
        'summaryDashboardController.getMetrics',
        { endpoint: '/metrics' },
      );
      return res.status(500).json({
        error: 'Failed to retrieve metrics',
        message: 'Unable to generate or retrieve dashboard metrics',
        trackingId,
      });
    }
    return res.json(snapshot);
  } catch (err) {
    const trackingId = logger.logException(err, 'summaryDashboardController.getMetrics', {
      endpoint: '/metrics',
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching dashboard metrics',
      trackingId,
    });
  }
};

// Get material cost trends
exports.getMaterialCosts = async (req, res) => {
  try {
    const data = await service.getMaterialCostTrends();
    return res.json(data);
  } catch (err) {
    const trackingId = logger.logException(err, 'summaryDashboardController.getMaterialCosts', {
      endpoint: '/materials/costs',
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching material cost trends',
      trackingId,
    });
  }
};

// Get metric history
exports.getHistory = async (req, res) => {
  try {
    const { startDate, endDate, metric } = req.query;

    // Validate required parameters
    if (!startDate || !endDate || !metric) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Missing required parameters: startDate, endDate, and metric are required',
        details: {
          missing: [!startDate && 'startDate', !endDate && 'endDate', !metric && 'metric'].filter(
            Boolean,
          ),
        },
      });
    }

    // Validate metric name
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid metric name: ${metric}`,
        details: {
          field: 'metric',
          provided: metric,
          validOptions: validMetrics,
        },
      });
    }

    // Validate date format
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid date format. Dates must be in ISO 8601 format (YYYY-MM-DD)',
        details: {
          startDate: Number.isNaN(start.getTime()) ? 'Invalid' : 'Valid',
          endDate: Number.isNaN(end.getTime()) ? 'Invalid' : 'Valid',
        },
      });
    }

    if (start > end) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'startDate must be before or equal to endDate',
        details: {
          startDate,
          endDate,
        },
      });
    }

    const history = await service.getHistory(startDate, endDate, metric);
    return res.json(history);
  } catch (err) {
    const trackingId = logger.logException(err, 'summaryDashboardController.getHistory', {
      endpoint: '/metrics/history',
      query: req.query,
    });

    // Check if it's a validation error from service
    if (err.message?.includes('Invalid')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: err.message,
        trackingId,
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching metric history',
      trackingId,
    });
  }
};
