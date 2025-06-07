const express = require('express');

module.exports = function (Availability) {
  const router = express.Router();
  const controller = require('../../controllers/lbdashboard/listingAvailablityController')(Availability);

  // Query by listingId
  router.get('/availability', controller.getAvailability);

  // CRUD by availability _id
  router.post('/availability', controller.createAvailability);
  router.get('/availability/:id', controller.getAvailabilityById);
  router.put('/availability/:id', controller.updateAvailability);
  router.delete('/availability/:id', controller.deleteAvailability);

  return router;
};