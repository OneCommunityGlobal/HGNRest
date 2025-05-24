const express = require('express');
const Sentry = require('@sentry/node');

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');
// const socialMediaRoutes = require('./routes/socialMediaRoutes');

logger.init();

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

require('./startup/compression')(app);
require('./startup/cors')(app);
require('./startup/bodyParser')(app);
require('./startup/middleware')(app);
require('./startup/routes')(app);

app.set('view engine', 'ejs');

// app.use('/social-media', socialMediaRoutes);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Make it the last middleware since it returns a response and do not call next()
app.use(globalErrorHandler);

module.exports = { app, logger };
