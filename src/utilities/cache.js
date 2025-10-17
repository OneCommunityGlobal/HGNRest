const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: Number(process.env.CACHE_TTL_SECONDS || 300) });

module.exports = {
  get: (k) => cache.get(k),
  set: (k, v) => cache.set(k, v),
};
