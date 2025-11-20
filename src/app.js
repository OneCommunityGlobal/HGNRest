const express = require('express');
const Sentry = require('@sentry/node');

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');

logger.init();

app.use(Sentry.Handlers.requestHandler());

// ✅ Mount analytics routes
const analyticsRoutes = require('./routes/applicantAnalyticsRoutes');

app.use('/api/applicants', analyticsRoutes);

// Then load all other setup
require('./startup/compression')(app);
require('./startup/cors')(app);
require('./startup/bodyParser')(app);
require('./startup/middleware')(app);

// ⚠ This must come *after* your custom /api routes
require('./startup/routes')(app);
const devRoutes = require('./routes/devRoutes');

app.use('/api/dev', devRoutes);
app.use(Sentry.Handlers.errorHandler());
app.use(globalErrorHandler);

module.exports = { app, logger };
