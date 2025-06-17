const express = require('express');

module.exports = function (Availability) {
  const router = express.Router();
  const controller = require('../../controllers/lbdashboard/listingAvailablityController')(Availability);

  router.get('/listing/availablity', controller.getListingAvailablity);
  router.post('/listing/availablity', controller.createListingAvailability);
  router.put('/listing/availablity/booking', controller.updateListingBooking);
  router.put('/listing/availablity/booking/update', controller.updateBookedDate);
  router.delete('/listing/availablity/booking', controller.deleteBookedDate);
  router.put('/listing/availablity/block', controller.updateListingBlockedDates);
  router.delete('/listing/availablity', controller.deleteListingAvailability);

  return router;
};