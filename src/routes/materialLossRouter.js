const express = require('express');

const routes = function () {
  const router = express.Router();

  router.route('/loss-tracking').get((req, res) => res.json({ message: 'Get material loss data' }));

  return router;
};

module.exports = routes;
