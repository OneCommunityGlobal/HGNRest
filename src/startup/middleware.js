const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');

module.exports = function (app) {
  app.all('*', (req, res, next) => {
    // Only handle specific routes here if needed, otherwise always call next()
    next();
  });
};
