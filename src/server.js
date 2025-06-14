/* eslint-disable quotes */
require('dotenv').load();
const http = require('http');
const { app, logger } = require('./app');
const websockets = require('./websockets').default;
require('./startup/db')();
require('./cronjobs/userProfileJobs')();

require('./cronjobs/bidWinnerJobs')();

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
  console.log(`🚀 Server is listening on http://localhost:${port}`);
});

(async () => {
  await websockets(server);
})();
module.exports = server;
