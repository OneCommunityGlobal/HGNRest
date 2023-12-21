const express = require('express');

const routes = function () {
  const equipmentRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmEquipmentController')();
  equipmentRouter.route('/equipment/add')
    .post(controller.addEquipmentType);

  return equipmentRouter;
};

module.exports = routes;
