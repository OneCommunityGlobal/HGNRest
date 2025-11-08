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

const weeklyReportsRouter = require('./routes/weeklyReportsRouter');

app.use('/api', weeklyReportsRouter);

// ⚠ This must come *after* your custom /api routes
require('./startup/routes')(app);

app.use(Sentry.Handlers.errorHandler());
app.use(globalErrorHandler);

module.exports = { app, logger };
