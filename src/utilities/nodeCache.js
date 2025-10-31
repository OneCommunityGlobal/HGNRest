const NodeCache = require('node-cache');
const logger = require('../startup/logger');

const cacheStore = new NodeCache({ stdTTL: 300, checkperiod: 600 });

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

  /**
   * Reset or redefine the ttl of a key. If ttl is not passed or set to 0 it's similar to .del()
   * @param {*} key
   * @param {*} ttl
   */
  function setKeyTimeToLive(key, ttl) {
    cacheStore.ttl(key, ttl);
  }

  function clearByPrefix(prefix) {
    try {
      const keys = cacheStore.keys();
      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          cacheStore.del(key);
        }
      });
    } catch (error) {
      logger.logException(error);
    }
  }

  return {
    setCache,
    getCache,
    removeCache,
    hasCache,
    setKeyTimeToLive,
    clearByPrefix,
  };
};

module.exports = cache;
