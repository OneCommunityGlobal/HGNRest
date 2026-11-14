const express = require('express');

const routes = function (BuildingTool, BuildingEquipment, UserProfile) {
  const router = express.Router();
  const controller = require('../../controllers/bmdashboard/bmRentalActionsController')(
    BuildingTool,
    BuildingEquipment,
    UserProfile,
  );

  router.route('/rentals/:itemId/return').put(controller.markReturned);
  router.route('/rentals/:itemId/extend').put(controller.extendRental);
  router.route('/rentals/:itemId/reminder').post(controller.sendReminder);

  return router;
};

module.exports = routes;
