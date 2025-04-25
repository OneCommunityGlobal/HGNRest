/* eslint-disable quotes */
require('dotenv').load();
const { app, logger } = require('./app');
const { setupMessagingWebSocket } = require('./websockets');
const websockets = require('./websockets').default;
require('./startup/db')();
require('./cronjobs/userProfileJobs')();

const port = process.env.PORT || 4500;

const server = app.listen(port, () => {
  logger.logInfo(`Started server on port ${port}`);
});
(async () => {
  await websockets(server);
  setupMessagingWebSocket(server);
})();

module.exports = server;