const express = require('express');
const Sentry = require('@sentry/node');

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');
// const experienceRoutes = require('./routes/applicantAnalyticsRoutes');

logger.init();

app.use(Sentry.Handlers.requestHandler());

// Then load all other setup
require('./startup/compression')(app);
require('./startup/cors')(app);
require('./startup/bodyParser')(app);

const helpFeedbackRouter = require('./routes/helpFeedbackRouter');
const helpRequestRouter = require('./routes/helpRequestRouter');

app.use('/api/feedback', helpFeedbackRouter);
app.use('/api/helprequest', helpRequestRouter);

require('./startup/middleware')(app);

// ⚠ This must come *after* your custom /api routes
require('./startup/routes')(app);

app.use(Sentry.Handlers.errorHandler());
app.use(globalErrorHandler);

module.exports = { app, logger };
