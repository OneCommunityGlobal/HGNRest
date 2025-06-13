const express = require('express');

module.exports = function (Availability) {
  const router = express.Router();
  const controller = require('../../controllers/lbdashboard/listingAvailablityController')(Availability);

  router.get('/availability', controller.getAvailabilities);

  router.post('/availability', controller.createAvailability);
  router.get('/availability/:id', controller.getAvailabilityById);
  router.put('/availability/:id', controller.updateAvailability);
  router.delete('/availability/:id', controller.deleteAvailability);

  return router;
};