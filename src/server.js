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

console.log('Calling initSocket...');
initSocket(server);
console.log('initSocket initialized');

// Start the actual server
server.listen(port, () => {
  console.log(`🚀 Server is listening on http://localhost:${port}`);
});

(async () => {
  await websockets(server);
})();
/*
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
});

app.get('/', (req, res) => {
  res.send('Hello from the root route!');
});
// Optional catch-all for 404s
app.use((req, res) => {
  res.status(404).send(`Not found: ${req.method} ${req.originalUrl}`);
});
*/
module.exports = server;
