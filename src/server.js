/* eslint-disable quotes */
require('dotenv').load();
require('./jobs/dailyMessageEmailNotification');
const { app, logger } = require('./app');
const TimerWebsockets = require('./websockets').default;
const MessagingWebSocket = require('./websockets/lbMessaging/messagingSocket').default;
require('./startup/db')();
require('./cronjobs/userProfileJobs')();
const websocketRouter = require('./websockets/webSocketRouter');

const port = process.env.PORT || 4500;

const server = app.listen(port, () => {
  logger.logInfo(`Started server on port ${port}`);
});

const timerService = TimerWebsockets();
const messagingService = MessagingWebSocket();

websocketRouter(server, [timerService, messagingService]);


module.exports = server;