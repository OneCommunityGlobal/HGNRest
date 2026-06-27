const NodeCache = require('node-cache');

// Create different cache instances for different data types
const analyticsCache = new NodeCache({
  stdTTL: Number(process.env.ANALYTICS_CACHE_TTL_SECONDS || 600), // 10 minutes default
  checkperiod: 120, // Check for expired keys every 2 minutes
});

const generalCache = new NodeCache({
  stdTTL: Number(process.env.CACHE_TTL_SECONDS || 300), // 5 minutes default
  checkperiod: 60, // Check for expired keys every minute
});

// Cache for frequently accessed static data (roles, etc.)
const staticCache = new NodeCache({
  stdTTL: Number(process.env.STATIC_CACHE_TTL_SECONDS || 3600), // 1 hour default
  checkperiod: 300, // Check for expired keys every 5 minutes
});

module.exports = {
  // General cache for most operations
  get: (k) => generalCache.get(k),
  set: (k, v) => generalCache.set(k, v),

  // Analytics-specific cache with longer TTL
  analytics: {
    get: (k) => analyticsCache.get(k),
    set: (k, v) => analyticsCache.set(k, v),
    del: (k) => analyticsCache.del(k),
    flush: () => analyticsCache.flushAll(),
  },

  // Static data cache for roles, etc.
  static: {
    get: (k) => staticCache.get(k),
    set: (k, v) => staticCache.set(k, v),
    del: (k) => staticCache.del(k),
    flush: () => staticCache.flushAll(),
  },

  // Utility functions
  clearAll: () => {
    generalCache.flushAll();
    analyticsCache.flushAll();
    staticCache.flushAll();
  },

  getStats: () => ({
    general: generalCache.getStats(),
    analytics: analyticsCache.getStats(),
    static: staticCache.getStats(),
  }),
};
