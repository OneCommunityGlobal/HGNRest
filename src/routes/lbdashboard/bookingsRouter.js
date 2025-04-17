const express = require('express');
const router = express.Router();
const bookingsController = require('../controllers/lbdashboard/listingpayment');
const Booking = require('../models/lbdashboard/bookings');
const Listings = require('../models/lbdashboard/listings');

const { createPaymentIntent, bookListing } = bookingsController(Booking);

router.post('/create-payment-intent', authenticateUser, createPaymentIntent);
router.post('/book', authenticateUser, bookListing);

module.exports = router;