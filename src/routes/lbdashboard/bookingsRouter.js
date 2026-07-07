const express = require('express');

const router = express.Router();
const Booking = require('../../models/lbdashboard/bookings');
const Listing = require('../../models/lbdashboard/listings');
const User = require('../../models/userProfile');
const BookingHold = require('../../models/lbdashboard/bookinghold');
const controller = require('../../controllers/lbdashboard/bookingsController')(
  Booking,
  Listing,
  User,
  BookingHold,
);

router.post('/create-payment-intent', controller.createPaymentIntent);
router.post('/book', controller.createBooking);

module.exports = router;
