var express = require('express');
require('dotenv').load();


const app = express();
const logger = require("./startup/logger");

logger.init();
require("./startup/cors")(app)
require("./startup/db")()
require("./startup/bodyParser")(app)
require("./startup/middleware")(app)
require('./cronjobs/userProfileJobs')();
require("./startup/routes")(app)

const port = process.env.PORT || 4500;

const server = app.listen(port, () =>

{
	logger.logInfo(`Started server on port ${port}`);

})
module.exports = server;