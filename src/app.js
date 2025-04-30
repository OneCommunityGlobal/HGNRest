const express = require('express');
const Sentry = require('@sentry/node');

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');

logger.init();

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

require('./startup/cors')(app);
require('./startup/bodyParser')(app);
require('./startup/middleware')(app);
require('./startup/routes')(app);

// const jobAnalyticsRoutes = require('./routes/jobAnalytics');

// app.use('/api/job-analytics', jobAnalyticsRoutes);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Make it the last middleware since it returns a response and do not call next()
app.use(globalErrorHandler);

module.exports = { app, logger };
