const cache = {};
const MINUTES_TO_MS = 60 * 1000;
const DEFAULT_TTL = 5 * MINUTES_TO_MS;

function setCache(key, value, ttl = DEFAULT_TTL) {
  // const cacheKey = `popularity_${JSON.stringify(key)}`;
  const expires = Date.now() + ttl;
  cache[key] = { value, expires };
}

function getCache(key) {
  // const cacheKey = `popularity_${JSON.stringify(key)}`;
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    delete cache[key];
    return null;
  }
  return entry.value;
}

function clearCache(key) {
  if (key) delete cache[key];
  else Object.keys(cache).forEach((k) => delete cache[k]);
}

module.exports = { setCache, getCache, clearCache };
