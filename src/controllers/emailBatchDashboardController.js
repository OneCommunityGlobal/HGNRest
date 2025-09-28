/**
 * Simplified Email Batch Dashboard Controller - Production Ready
 * Focus: Essential dashboard endpoints only
 */

const EmailBatchService = require('../services/emailBatchService');
const logger = require('../startup/logger');

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const stats = await EmailBatchService.getDashboardStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.logException(error, 'Error getting dashboard stats');
    res.status(500).json({
      success: false,
      message: 'Error getting dashboard stats',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
};
