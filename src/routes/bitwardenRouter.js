const express = require('express');

const routes = () => {
  const controller = require('../controllers/bitwardenController')();
  const bitwardenRouter = express.Router();

  // Auth endpoints
  bitwardenRouter.route('/auth').get(controller.authenticate);

  return bitwardenRouter;
};

module.exports = routes;
