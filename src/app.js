const express = require('express');
const Sentry = require('@sentry/node');

const app = express();
const logger = require('./startup/logger');

logger.init();
// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());
require('./startup/cors')(app);
require('./startup/bodyParser')(app);
require('./startup/middleware')(app);
require('./startup/routes')(app);

module.exports = { app, logger, Sentry };
