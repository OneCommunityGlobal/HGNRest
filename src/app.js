const express = require('express');

const app = express();
const logger = require('./startup/logger');

logger.init();
require('./startup/cors')(app);
require('./startup/bodyParser')(app);
require('./startup/middleware')(app);
require('./startup/routes')(app);

module.exports = { app, logger };