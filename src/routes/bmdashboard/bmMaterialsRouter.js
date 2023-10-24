const express = require('express');

const routes = function (itemMaterial) {
const materialsRouter = express.Router();
const controller = require('../../controllers/bmdashboard/bmMaterialsController')(itemMaterial);

materialsRouter.route('/materials')
  .get(controller.bmMaterialsList);

materialsRouter.route('/materialsByProjectIdAndCheckInOut')
  .get(controller.bmGetMaterialsListByProjectIdAndCheckInOut);

materialsRouter.route('/postMaterialLog')
  .post(controller.bmPostMaterialLog);

  return materialsRouter;
}

module.exports = routes;