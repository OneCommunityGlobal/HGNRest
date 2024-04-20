/* eslint-disable quotes */
require('dotenv').load();

const { app, logger, Sentry } = require('./app');
const websockets = require('./websockets').default;

require('./startup/db')();
require('./cronjobs/userProfileJobs')();

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
