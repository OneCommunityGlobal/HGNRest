require('dotenv').config();
const app = require('./app');
const logger = require('./startup/logger'); // if you have a logger
require('./startup/db')(); // DB connection if applicable
require('./cronjobs/userProfileJobs')(); // if needed

const port = process.env.PORT || 4500;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  logger && logger.logInfo(`Started server on port ${port}`);
});

module.exports = server;
