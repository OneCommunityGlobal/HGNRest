const express = require('express');
const Sentry = require('@sentry/node');
const testRoutes = require('./routes/testRoutes');

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');

logger.init();

app.use(Sentry.Handlers.requestHandler());

// 1. Load basic setups (CORS, body parser, session, etc.) first
require('./startup/compression')(app);
require('./startup/cors')(app);
require('./startup/bodyParser')(app);
require('./startup/session')(app);

// 2. 💡 Mount YouTube routes after CORS and session so they have cross-origin and session support while bypassing subsequent global auth middleware
const youtubeAutoPosterRouter = require('./routes/youtubeAutoPosterRouter');

app.use('/api/youtube', youtubeAutoPosterRouter);

app.use('/api/test', testRoutes);

const helpFeedbackRouter = require('./routes/helpFeedbackRouter');
const helpRequestRouter = require('./routes/helpRequestRouter');

app.use('/api/feedback', helpFeedbackRouter);
app.use('/api/helprequest', helpRequestRouter);

require('./startup/middleware')(app);

const weeklyReportsRouter = require('./routes/weeklyReportsRouter');

app.use('/api', weeklyReportsRouter);

// ⚠ This must come *after* your custom /api routes
require('./startup/routes')(app);

app.use(Sentry.Handlers.errorHandler());
app.use(globalErrorHandler);

module.exports = { app, logger };
