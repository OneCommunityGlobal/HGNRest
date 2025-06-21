const express = require('express');

module.exports = function (Availability) {
  const router = express.Router();
  const controller = require('../../controllers/lbdashboard/listingAvailablityController')(Availability);

  router.get('/listing/availability', controller.getListingAvailablity);
  router.post('/listing/availability', controller.createListingAvailability);
  router.put('/listing/availability/booking', controller.updateListingBooking);
  router.put('/listing/availability/booking/update', controller.updateBookedDate);
  router.delete('/listing/availability/booking', controller.deleteBookedDate);
  router.put('/listing/availability/block', controller.updateListingBlockedDates);
  router.delete('/listing/availability', controller.deleteListingAvailability);

  return router;
};