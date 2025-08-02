const express = require('express');
const router = express.Router();
const Booking = require('../../models/lbdashboard/bookings');
const Listing = require('../../models/lbdashboard/listings');
const bookingPaymentController = require('../../controllers/lbdashboard/bookingsController')(Booking, Listing);

const { createPaymentIntent, bookListing } = bookingPaymentController;

router.post('/create-payment-intent', createPaymentIntent);
router.post('/book', bookListing);

module.exports = router;
