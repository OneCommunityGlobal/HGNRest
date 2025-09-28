/**
 * Simplified Email Batch Controller - Production Ready
 * Focus: Essential batch management endpoints
 */

const EmailBatchService = require('../services/emailBatchService');
const emailBatchProcessor = require('../services/emailBatchProcessor');
const logger = require('../startup/logger');

/**
 * Get all batches with pagination and filtering
 */
const getBatches = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;

    const filters = { status, dateFrom, dateTo };
    const result = await EmailBatchService.getBatches(
      filters,
      parseInt(page, 10),
      parseInt(limit, 10),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.logException(error, 'Error getting batches');
    res.status(500).json({
      success: false,
      message: 'Error getting batches',
      error: error.message,
    });
  }
};

/**
 * Get batch details with items
 */
const getBatchDetails = async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await EmailBatchService.getBatchWithItems(batchId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.logException(error, 'Error getting batch details');
    res.status(500).json({
      success: false,
      message: 'Error getting batch details',
      error: error.message,
    });
  }
};

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

/**
 * Get processor status
 */
const getProcessorStatus = async (req, res) => {
  try {
    const status = emailBatchProcessor.getStatus();

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.logException(error, 'Error getting processor status');
    res.status(500).json({
      success: false,
      message: 'Error getting processor status',
      error: error.message,
    });
  }
};

// Retry a failed batch item
const retryBatchItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    // Find the batch item
    const EmailBatchItem = require('../models/emailBatchItem');
    const item = await EmailBatchItem.findById(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Batch item not found',
      });
    }

    // Check if item is already being processed
    if (item.status === 'SENDING') {
      return res.status(400).json({
        success: false,
        message: 'Batch item is currently being processed',
      });
    }

    // Only allow retry for FAILED or PENDING items
    if (item.status !== 'FAILED' && item.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only failed or pending items can be retried',
      });
    }

    // Reset the item status to PENDING for retry
    item.status = 'PENDING';
    item.attempts = 0;
    item.error = null;
    item.failedAt = null;
    item.lastAttemptedAt = null;
    await item.save();

    // Use the processor's retry method
    const emailBatchProcessorService = require('../services/emailBatchProcessor');
    await emailBatchProcessorService.retryBatchItem(itemId);

    res.json({
      success: true,
      message: 'Batch item retry initiated',
      data: {
        itemId: item._id,
        status: item.status,
        attempts: item.attempts,
      },
    });
  } catch (error) {
    logger.logException(error, 'Error retrying batch item');
    res.status(500).json({
      success: false,
      message: 'Error retrying batch item',
      error: error.message,
    });
  }
};

module.exports = {
  getBatches,
  getBatchDetails,
  getDashboardStats,
  getProcessorStatus,
  retryBatchItem,
};
