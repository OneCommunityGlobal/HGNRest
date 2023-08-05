/* eslint-disable quotes */
require("dotenv").load();

const express = require("express");
const websockets = require("./websockets").default;

const app = express();
const logger = require("./startup/logger");

logger.init();
require("./startup/cors")(app);
require("./startup/db")();
require("./startup/bodyParser")(app);
require("./startup/middleware")(app);
require("./cronjobs/userProfileJobs")();
require("./startup/routes")(app);

const port = process.env.PORT || 4500;

const server = app.listen(port, () => {
  logger.logInfo(`Started server on port ${port}`);
});
(async () => {
  await websockets(server);
})();

module.exports = server;
