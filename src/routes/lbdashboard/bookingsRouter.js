const express = require('express');
const router = express.Router();
const Booking = require('../../models/lbdashboard/bookings');
const Listing = require('../../models/lbdashboard/listings');
const bookingsController = require('../../controllers/lbdashboard/listingpayment')(Booking, Listing);

const { createPaymentIntent, bookListing } = bookingsController;

router.post('/create-payment-intent', createPaymentIntent);
router.post('/book', bookListing);

module.exports = router;
