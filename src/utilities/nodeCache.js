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

  /**
   * Remove all cache keys that start with a given prefix
   */
  function removeByPrefix(prefix) {
    try {
      const keys = cacheStore.keys(); // NodeCache gives you all keys
      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          cacheStore.del(key);
          console.log(`🧹 Removed cache key: ${key}`);
        }
      });
    } catch (e) {
      logger.logException(e);
    }
  }

  return {
    setCache,
    getCache,
    removeCache,
    hasCache,
    setKeyTimeToLive,
    removeByPrefix // new function
  };
};

module.exports = cache;
