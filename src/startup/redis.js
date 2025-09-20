const redisCache = require('../utilities/redisCache');
const logger = require('./logger');

module.exports = async function () {
  try {
    const cache = redisCache();
    await cache.initializeRedis();
    logger.logInfo('Redis initialization completed');
  } catch (error) {
    logger.logException(error);
    logger.logInfo('Redis initialization failed, falling back to in-memory cache');
  }
};
