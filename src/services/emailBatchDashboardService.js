/**
 * Enhanced Email Batch Dashboard Service
 *
 * FEATURES:
 * - Caching for performance
 * - Pagination for large datasets
 * - Real-time updates
 * - Performance analytics
 * - Memory optimization
 */

const EmailBatch = require('../models/emailBatch');
const EmailBatchItem = require('../models/emailBatchItem');
const logger = require('../startup/logger');

class EmailBatchDashboardService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    this.maxCacheSize = 100;
  }

  /**
   * Get dashboard data with caching and performance optimization
   */
  async getDashboardData(filters = {}) {
    const cacheKey = this.generateCacheKey('dashboard', filters);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const data = await this.fetchDashboardData(filters);

      // Cache the result
      this.setCache(cacheKey, data);

      return data;
    } catch (error) {
      logger.logException(error, 'Error fetching dashboard data');
      throw error;
    }
  }

  /**
   * Fetch dashboard data with optimized queries
   */
  async fetchDashboardData(filters) {
    const query = this.buildQuery(filters);

    // Use aggregation pipeline for better performance
    const [overviewStats, emailStats, performanceStats, recentBatches] = await Promise.all([
      this.getOverviewStats(query),
      this.getEmailStats(query),
      this.getPerformanceStats(query),
      this.getRecentBatches(query, 10),
    ]);

    return {
      overview: overviewStats,
      emailStats,
      performance: performanceStats,
      recentBatches,
      filters,
      timestamp: new Date(),
    };
  }

  /**
   * Get overview statistics
   */
  static async getOverviewStats(query) {
    const stats = await EmailBatch.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          pendingBatches: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          processingBatches: { $sum: { $cond: [{ $eq: ['$status', 'PROCESSING'] }, 1, 0] } },
          completedBatches: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          failedBatches: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
        },
      },
    ]);

    return (
      stats[0] || {
        totalBatches: 0,
        pendingBatches: 0,
        processingBatches: 0,
        completedBatches: 0,
        failedBatches: 0,
      }
    );
  }

  /**
   * Get email statistics
   */
  static async getEmailStats(query) {
    const stats = await EmailBatch.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: '$totalEmails' },
          sentEmails: { $sum: '$sentEmails' },
          failedEmails: { $sum: '$failedEmails' },
          pendingEmails: { $sum: '$pendingEmails' },
        },
      },
    ]);

    const result = stats[0] || {
      totalEmails: 0,
      sentEmails: 0,
      failedEmails: 0,
      pendingEmails: 0,
    };

    result.successRate =
      result.totalEmails > 0 ? Math.round((result.sentEmails / result.totalEmails) * 100) : 0;

    return result;
  }

  /**
   * Get performance statistics
   */
  static async getPerformanceStats(query) {
    const stats = await EmailBatch.aggregate([
      {
        $match: {
          ...query,
          status: 'COMPLETED',
          startedAt: { $exists: true },
        },
      },
      {
        $project: {
          processingTime: { $subtract: ['$completedAt', '$startedAt'] },
          totalEmails: 1,
          createdAt: 1,
        },
      },
      {
        $group: {
          _id: null,
          avgProcessingTime: { $avg: '$processingTime' },
          avgEmailsPerBatch: { $avg: '$totalEmails' },
          totalProcessingTime: { $sum: '$processingTime' },
          batchCount: { $sum: 1 },
        },
      },
    ]);

    const result = stats[0] || {
      avgProcessingTime: null,
      avgEmailsPerBatch: 0,
      totalProcessingTime: 0,
      batchCount: 0,
    };

    return {
      avgProcessingTime: result.avgProcessingTime
        ? Math.round(result.avgProcessingTime / 1000)
        : null,
      avgEmailsPerBatch: Math.round(result.avgEmailsPerBatch || 0),
      totalProcessingTime: result.totalProcessingTime
        ? Math.round(result.totalProcessingTime / 1000)
        : 0,
      batchCount: result.batchCount,
    };
  }

  /**
   * Get recent batches with pagination
   */
  static async getRecentBatches(query, limit = 10) {
    const batches = await EmailBatch.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('createdBy', 'firstName lastName email')
      .select(
        'batchId name status totalEmails sentEmails failedEmails progress createdAt completedAt subject createdBy',
      );

    return batches.map((batch) => ({
      batchId: batch.batchId,
      name: batch.name,
      status: batch.status,
      totalEmails: batch.totalEmails,
      sentEmails: batch.sentEmails,
      failedEmails: batch.failedEmails,
      progress: batch.progress,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
      subject: batch.subject,
      createdBy: batch.createdBy,
    }));
  }

  /**
   * Get batch details with pagination for large batches
   */
  async getBatchDetails(batchId, page = 1, limit = 100) {
    const cacheKey = this.generateCacheKey('batchDetails', { batchId, page, limit });

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const batch = await EmailBatch.findOne({ batchId }).populate(
        'createdBy',
        'firstName lastName email',
      );

      if (!batch) {
        throw new Error('Batch not found');
      }

      // Get batch items with pagination
      const skip = (page - 1) * limit;
      const [batchItems, totalItems] = await Promise.all([
        EmailBatchItem.find({ batchId: batch._id })
          .select('recipients status attempts sentAt failedAt error createdAt')
          .sort({ createdAt: 1 })
          .limit(limit)
          .skip(skip),
        EmailBatchItem.countDocuments({ batchId: batch._id }),
      ]);

      const data = {
        batch: {
          batchId: batch.batchId,
          name: batch.name,
          description: batch.description,
          status: batch.status,
          subject: batch.subject,
          htmlContent: batch.htmlContent,
          attachments: batch.attachments || [],
          metadata: batch.metadata,
          createdBy: batch.createdBy,
          createdByName: batch.createdByName,
          createdByEmail: batch.createdByEmail,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
          startedAt: batch.startedAt,
          completedAt: batch.completedAt,
        },
        statistics: {
          totalEmails: batch.totalEmails,
          sentEmails: batch.sentEmails,
          failedEmails: batch.failedEmails,
          pendingEmails: batch.pendingEmails,
          progress: batch.progress,
        },
        items: batchItems,
        pagination: {
          page,
          limit,
          total: totalItems,
          pages: Math.ceil(totalItems / limit),
        },
      };

      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      logger.logException(error, 'Error fetching batch details');
      throw error;
    }
  }

  /**
   * Get batches with advanced filtering and pagination
   */
  async getBatches(filters = {}, page = 1, limit = 20) {
    const query = this.buildQuery(filters);
    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      EmailBatch.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate('createdBy', 'firstName lastName email')
        .select(
          'batchId name status totalEmails sentEmails failedEmails progress createdAt completedAt subject createdBy',
        ),
      EmailBatch.countDocuments(query),
    ]);

    return {
      batches: batches.map((batch) => ({
        batchId: batch.batchId,
        name: batch.name,
        status: batch.status,
        totalEmails: batch.totalEmails,
        sentEmails: batch.sentEmails,
        failedEmails: batch.failedEmails,
        progress: batch.progress,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt,
        subject: batch.subject,
        createdBy: batch.createdBy,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Build query from filters
   */
  static buildQuery(filters) {
    const query = {};

    if (filters.dateFrom) {
      query.createdAt = { $gte: new Date(filters.dateFrom) };
    }
    if (filters.dateTo) {
      query.createdAt = { ...query.createdAt, $lte: new Date(filters.dateTo) };
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.type) {
      query['metadata.type'] = filters.type;
    }
    if (filters.createdBy) {
      query.createdBy = filters.createdBy;
    }

    return query;
  }

  /**
   * Cache management
   */
  static generateCacheKey(prefix, params) {
    return `${prefix}_${JSON.stringify(params)}`;
  }

  setCache(key, data) {
    // Implement LRU cache
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      timeout: this.cacheTimeout,
    };
  }
}

module.exports = new EmailBatchDashboardService();
