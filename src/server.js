/* eslint-disable quotes */
require('dotenv').load();

const express = require('express');
const Sentry = require('@sentry/node');
const websockets = require('./websockets').default;

const app = express();
const logger = require('./startup/logger');

logger.init();
// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());
require('./startup/cors')(app);
require('./startup/db')();
require('./startup/bodyParser')(app);
require('./startup/middleware')(app);
require('./cronjobs/userProfileJobs')();
require('./startup/routes')(app);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());
const port = process.env.PORT || 4500;

const server = app.listen(port, () => {
  logger.logInfo(`Started server on port ${port}`);
});
(async () => {
  await websockets(server);
})();

module.exports = server;
