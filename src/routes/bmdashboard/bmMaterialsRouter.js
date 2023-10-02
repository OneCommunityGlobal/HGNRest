const express = require('express');

const routes = function () {
const materialsRouter = express.Router();
const controller = require('../../controllers/bmdashboard/bmMaterialsController')();

materialsRouter.route('/materials')
  .get(controller.bmMaterialsList);

  return materialsRouter;
}

module.exports = routes;