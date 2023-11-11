const express = require('express');

const routes = function (buildingMaterial) {
const materialsRouter = express.Router();
const controller = require('../../controllers/bmdashboard/bmMaterialsController')(buildingMaterial);

materialsRouter.route('/materials')
  .get(controller.bmMaterialsList);

materialsRouter.route('/addUpdateMaterialRecord')
  .post(controller.bmPostMaterialUpdateRecord);

  materialsRouter.route('/UpdateMaterialRecordBulk')
  .post(controller.bmPostMaterialUpdateBulk);

  

  return materialsRouter;
};

module.exports = routes;
