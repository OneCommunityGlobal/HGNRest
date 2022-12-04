
const NodeCache = require('node-cache');
const logger = require('../startup/logger');

const cacheStore = new NodeCache({ stdTTL: 300, checkPeriod: 600 });

const cache = function () {
  function getCache(key) {
    try {
      if (cacheStore.has(key)) {
        return cacheStore.get(key);
      }
    } catch (e) {
      logger.logException(e);
    }
    return '';
  }

  function removeCache(key) {
    try {
      if (cacheStore.has(key)) {
        cacheStore.del(key);
      }
    } catch (e) {
      logger.logException(e);
    }
  }

  function setCache(key, response) {
    try {
      const cacheData = cacheStore.get(key);
      if (cacheData) {
        cacheStore.del(key);
      }
      cacheStore.set(key, response);
    } catch (e) {
      logger.logException(e);
    }
  }

  function hasCache(key) {
    return cacheStore.has(key);
  }

  return {
    setCache,
    getCache,
    removeCache,
    hasCache,
  };
};

module.exports = cache;
