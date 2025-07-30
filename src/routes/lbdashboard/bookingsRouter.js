const express = require('express');
const router = express.Router();
const bookingsController = require('../../controllers/lbdashboard/listingpayment');
const Booking = require('../../models/lbdashboard/bookings');
const Listings = require('../../models/lbdashboard/listings');

const { createPayPalOrder, bookListing } = bookingsController(Booking);

router.post('/create-payment-intent', createPayPalOrder);
router.post('/book', bookListing);

module.exports = router;
