/* eslint-disable quotes */
require('dotenv').config();
const http = require('http');
require('./jobs/dailyMessageEmailNotification');
const { app, logger } = require('./app');
const TimerWebsockets = require('./websockets').default;
const MessagingWebSocket = require('./websockets/lbMessaging/messagingSocket').default;
require('./startup/db')();
require('./cronjobs/userProfileJobs')();
require('./jobs/analyticsAggregation').scheduleDaily();
require('./cronjobs/bidWinnerJobs')();
require('./jobs/facebookScheduler')();
const websocketRouter = require('./websockets/webSocketRouter');

const port = process.env.PORT || 4500;

// Create HTTP server for both Express and Socket.IO
const server = http.createServer(app);
logger.logInfo(`Started server on port ${port}`);

// Initialize socket.io
// require('./sockets/BiddingService/connServer')(server);
// // 👈 this is important
const { initSocket } = require('./sockets/BiddingService/connServer');

initSocket(server);

// Start the actual server
server.listen(port, () => {
  // Server started
});

const timerService = TimerWebsockets();
const messagingService = MessagingWebSocket();

websocketRouter(server, [timerService, messagingService]);

module.exports = server;
