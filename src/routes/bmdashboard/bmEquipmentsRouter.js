const express = require('express');

const routes = function (BuildingEquipment) {
  const BuildingEquipmentController = express.Router();
  const controller = require('../../controllers/bmdashboard/bmEquipmentController')(BuildingEquipment);

  BuildingEquipmentController.route('/equipments')
    .get(controller.fetchBMEquipments);

  return BuildingEquipmentController;
};

module.exports = routes;
