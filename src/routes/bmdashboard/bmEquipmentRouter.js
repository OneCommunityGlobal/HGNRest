const express = require('express');

const routes = function (BuildingEquipment) {
  const equipmentRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmEquipmentController')(
    BuildingEquipment,
  );

  equipmentRouter
    .route('/equipment/:equipmentId')
    .get(controller.fetchSingleEquipment)
    .put(controller.updateEquipmentById);

  equipmentRouter.route('/equipment/:equipmentId/status').put(controller.updateEquipmentStatus);

  equipmentRouter.route('/equipment/purchase').post(controller.bmPurchaseEquipments);

  equipmentRouter.route('/equipments').get(controller.fetchBMEquipments);

  equipmentRouter.route('/equipments/logRecords').put(controller.updateLogRecords);

  return equipmentRouter;
};

module.exports = routes;
