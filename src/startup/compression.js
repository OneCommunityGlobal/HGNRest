const compression = require('compression');

module.exports = function (app) {
  // Remove Brotli to force gzip
  app.use((req, res, next) => {
    const enc = req.headers['accept-encoding'];
    if (enc && enc.includes('br')) {
      req.headers['accept-encoding'] = enc
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e !== 'br')
        .join(', ');
    }
    next();
  });

  const compressionOptions = {
    level: 6, // medium compression level
    threshold: 0, // compress everything
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;

      const contentType = res.getHeader && res.getHeader('Content-Type');
      const compressibleTypes = ['application/json', 'text/', 'application/javascript'];

      if (contentType && !compressibleTypes.some((type) => contentType.includes(type))) {
        return false;
      }

      return compression.filter(req, res);
    },
  };

  app.use(compression(compressionOptions));
};
