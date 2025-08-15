// Simple in-memory cache for popularity timeline data
// Only stores one key: the result of the last aggregation query
// TTL (time to live) is optional, default 5 minutes

const cache = {};
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Set cache for a specific key
 * @param {string} key - Unique cache key (e.g., based on query)
 * @param {any} value - Data to store
 * @param {number} ttl - Optional time to live in ms
 */
function setCache(key, value, ttl = DEFAULT_TTL) {
  const expires = Date.now() + ttl;
  cache[key] = { value, expires };
}

/**
 * Get cached value for a specific key
 * @param {string} key - Cache key
 * @returns {any|null} - Returns value if valid, else null
 */
function getCache(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    delete cache[key];
    return null;
  }
  return entry.value;
}

/**
 * Clear cache completely or for a specific key
 * @param {string} key - Optional key to clear. If not provided, clears all cache.
 */
function clearCache(key) {
  if (key) delete cache[key];
  else Object.keys(cache).forEach((k) => delete cache[k]);
}

module.exports = {
  setCache,
  getCache,
  clearCache,
};
