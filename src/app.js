const express = require('express');
const Sentry = require('@sentry/node');
const testRoutes = require('./routes/testRoutes');

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');
// const experienceRoutes = require('./routes/applicantAnalyticsRoutes');

// 1. Core initialization
logger.init();
app.use(Sentry.Handlers.requestHandler());

// 2. Load essential middleware (The "Engine")
require('./startup/compression')(app);
require('./startup/cors')(app);
require('./startup/bodyParser')(app); // <--- Crucial this runs before routes
require('./startup/session')(app); // Add session before middleware and routes

// 3. Define Routes (The "Destination")
// It is better to move these INSIDE startup/routes.js, but if they stay here:
app.use('/api/test', testRoutes);

const helpFeedbackRouter = require('./routes/helpFeedbackRouter');
const helpRequestRouter = require('./routes/helpRequestRouter');

app.use('/api/feedback', helpFeedbackRouter);
app.use('/api/helprequest', helpRequestRouter);

require('./startup/middleware')(app);
// This handles all other routes and likely has your 404 handler
require('./startup/routes')(app);

// 4. Error Handling (The "Safety Net")
app.use(Sentry.Handlers.errorHandler());
app.use(globalErrorHandler);

module.exports = { app, logger };
