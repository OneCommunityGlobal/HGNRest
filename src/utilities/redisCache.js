const { createClient } = require('redis');
const logger = require('../startup/logger');

let redisClient = null;

/**
 * Initialize Redis client
 */
const initializeRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.logInfo('Redis server connection refused, falling back to in-memory cache');
          return undefined; // Don't retry
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.logInfo('Redis retry time exhausted, falling back to in-memory cache');
          return undefined; // Don't retry
        }
        if (options.attempt > 10) {
          logger.logInfo('Redis max retry attempts reached, falling back to in-memory cache');
          return undefined; // Don't retry
        }
        return Math.min(options.attempt * 100, 3000);
      },
    });

    redisClient.on('error', (err) => {
      logger.logException(err);
      redisClient = null; // Disable Redis on error
    });

    redisClient.on('connect', () => {
      logger.logInfo('Redis client connected successfully');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.logException(error);
    redisClient = null;
    return null;
  }
};

/**
 * Redis cache utility with fallback to in-memory cache
 */
const redisCache = function () {
  const nodeCache = require('./nodeCache')();

  /**
   * Get value from cache (Redis first, then in-memory)
   */
  const getCache = async (key) => {
    try {
      // Try Redis first
      if (redisClient && redisClient.isOpen) {
        const value = await redisClient.get(key);
        if (value) {
          return JSON.parse(value);
        }
      }
    } catch (error) {
      logger.logException(error);
    }

    // Fallback to in-memory cache
    return nodeCache.getCache(key);
  };

  /**
   * Set value in cache (both Redis and in-memory)
   */
  const setCache = async (key, value, ttl = 300) => {
    try {
      // Set in Redis
      if (redisClient && redisClient.isOpen) {
        await redisClient.setEx(key, ttl, JSON.stringify(value));
      }
    } catch (error) {
      logger.logException(error);
    }

    // Always set in in-memory cache as backup
    nodeCache.setCache(key, value);
    nodeCache.setKeyTimeToLive(key, ttl);
  };

  /**
   * Check if key exists in cache
   */
  const hasCache = async (key) => {
    try {
      // Check Redis first
      if (redisClient && redisClient.isOpen) {
        const exists = await redisClient.exists(key);
        if (exists) {
          return true;
        }
      }
    } catch (error) {
      logger.logException(error);
    }

    // Fallback to in-memory cache
    return nodeCache.hasCache(key);
  };

  /**
   * Remove key from cache
   */
  const removeCache = async (key) => {
    try {
      // Remove from Redis
      if (redisClient && redisClient.isOpen) {
        await redisClient.del(key);
      }
    } catch (error) {
      logger.logException(error);
    }

    // Remove from in-memory cache
    nodeCache.removeCache(key);
  };

  /**
   * Remove multiple keys from cache
   */
  const removeCachePattern = async (pattern) => {
    try {
      // Remove from Redis
      if (redisClient && redisClient.isOpen) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      }
    } catch (error) {
      logger.logException(error);
    }

    // Note: node-cache doesn't support pattern removal, so we'll rely on TTL
  };

  /**
   * Set TTL for a key
   */
  const setKeyTimeToLive = async (key, ttl) => {
    try {
      // Set TTL in Redis
      if (redisClient && redisClient.isOpen) {
        await redisClient.expire(key, ttl);
      }
    } catch (error) {
      logger.logException(error);
    }

    // Set TTL in in-memory cache
    nodeCache.setKeyTimeToLive(key, ttl);
  };

  /**
   * Get cache statistics
   */
  const getCacheStats = async () => {
    const stats = {
      redis: {
        connected: redisClient && redisClient.isOpen,
        status: redisClient ? 'connected' : 'disconnected',
      },
      nodeCache: {
        keys: nodeCache.getStats ? nodeCache.getStats().keys : 'unknown',
        hits: nodeCache.getStats ? nodeCache.getStats().hits : 'unknown',
        misses: nodeCache.getStats ? nodeCache.getStats().misses : 'unknown',
      },
    };

    try {
      if (redisClient && redisClient.isOpen) {
        const info = await redisClient.info('memory');
        stats.redis.memory = info;
      }
    } catch (error) {
      logger.logException(error);
    }

    return stats;
  };

  return {
    getCache,
    setCache,
    hasCache,
    removeCache,
    removeCachePattern,
    setKeyTimeToLive,
    getCacheStats,
    initializeRedis,
  };
};

module.exports = redisCache;
