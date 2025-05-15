const express = require('express');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const routes = function (ListingHome) {
  const listingHomeRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/listingsController')(ListingHome);

  listingHomeRouter.route('/getListings').get(controller.getListings);
  listingHomeRouter.route('/createListing').post(upload.array('images', 10), controller.createListing);
  listingHomeRouter.get('/listings/:listingId/availability', controller.getAvailabilityForListing);
  listingHomeRouter.post('/listings/:listingId/availability', controller.updateListingAvailability);
  listingHomeRouter.get('/listings/:listingId/bookings', controller.getBookingHistory);
  listingHomeRouter.post('/listings/:listingId/reservations/cancel', controller.cancelReservation);
  listingHomeRouter.post('/listings/:listingId/reservations/confirm', controller.confirmReservation);

  return listingHomeRouter;
};

module.exports = routes;