const express = require('express');
const Sentry = require('@sentry/node');
const compression = require('compression'); // Import compression

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');

logger.init();

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// Gzip compression - start
app.use(compression({
  level: 6,        // Compression level (0 = no compression, 9 = max compression)
  threshold: 0, // Compress responses larger than 1KB
}))
// Gzip compression - end

require('./startup/cors')(app);
require('./startup/bodyParser')(app);
require('./startup/middleware')(app);
require('./startup/routes')(app);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Make it the last middleware since it returns a response and do not call next()
app.use(globalErrorHandler);

module.exports = { app, logger };
