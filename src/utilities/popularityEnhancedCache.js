// src/utilities/popularityEnhancedCache.js
/**
 * Enhanced Cache Utility for Popularity Analytics
 * Description: Advanced caching with role-based invalidation
 */

const cache = new Map();
const MINUTES_TO_MS = 60 * 1000;
const DEFAULT_TTL = 10 * MINUTES_TO_MS; // 10 minutes

class EnhancedPopularityCache {
  static set(key, value, ttl = DEFAULT_TTL) {
    const expires = Date.now() + ttl;
    cache.set(key, { value, expires });
  }

  static get(key) {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  static delete(key) {
    cache.delete(key);
  }

  static clear() {
    cache.clear();
  }

  // Role-based caching methods
  static setRoleData(role, data, ttl = DEFAULT_TTL) {
    const DATE_SLICE_LENGTH = 7;
    const key = `role_${role}_${new Date().toISOString().slice(0, DATE_SLICE_LENGTH)}`;
    this.set(key, data, ttl);
  }

  static getRoleData(role) {
    const keys = Array.from(cache.keys()).filter((k) => k.startsWith(`role_${role}_`));
    if (keys.length === 0) return null;

    const latestKey = keys.sort().reverse()[0];
    return this.get(latestKey);
  }

  // Clear cache for specific role
  static clearRoleCache(role) {
    const keys = Array.from(cache.keys()).filter((k) => k.includes(`role_${role}`));
    keys.forEach((key) => cache.delete(key));
  }

  // Get cache statistics
  static getStats() {
    return {
      size: cache.size,
      keys: Array.from(cache.keys()),
    };
  }
}

module.exports = EnhancedPopularityCache;
