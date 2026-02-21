/* eslint-disable import/order */
/* eslint-disable no-magic-numbers */
/* eslint-disable quotes */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
require('./jobs/dailyMessageEmailNotification');
const { app, logger } = require('./app');
const TimerWebsockets = require('./websockets').default;
const MessagingWebSocket = require('./websockets/lbMessaging/messagingSocket').default;
const emailProcessor = require('./services/announcements/emails/emailProcessor');
require('./startup/db')();
// const { initializeLiveJournalScheduler } = require('./utilities/liveJournalScheduler');
// initializeLiveJournalScheduler();
const liveJournalRoutes = require('./routes/liveJournalRoutes').default;
require('./cronjobs/userProfileJobs')();
require('./cronjobs/pullRequestReviewJobs')();
require('./cronjobs/mediumPostScheduler')();
require('./jobs/analyticsAggregation').scheduleDaily();
require('./cronjobs/bidWinnerJobs')();

// Process pending and stuck emails on startup (only after DB is connected)
mongoose.connection.once('connected', () => {
  emailProcessor.processPendingAndStuckEmails().catch((error) => {
    logger.logException(error, 'Error processing pending emails on startup');
  });
});

// eslint-disable-next-line import/order
const websocketRouter = require('./websockets/webSocketRouter');

const DEFAULT_PORT = 4500;
const port = process.env.PORT || DEFAULT_PORT;

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
// app.use('/api/livejournal', liveJournalRoutes);
websocketRouter(server, [timerService, messagingService]);

module.exports = server;
