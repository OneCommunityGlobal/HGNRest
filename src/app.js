const express = require('express');
const Sentry = require('@sentry/node');

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');

// Init
logger.init();
app.use(Sentry.Handlers.requestHandler());
app.use(express.json());

// Setup middleware before routes
require('./startup/compression')(app);
require('./startup/cors')(app);
require('./startup/bodyParser')(app);
require('./startup/middleware')(app);

// Other route handlers
require('./startup/routes')(app);

// Error handling
app.use(Sentry.Handlers.errorHandler());
app.use(globalErrorHandler);

module.exports = { app, logger };
