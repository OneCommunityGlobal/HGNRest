const mongoose = require('mongoose');
const Booking = require('../models/lbdashboard/bookings');
const Listing = require('../models/lbdashboard/listings');
const paypal = require('@paypal/checkout-server-sdk');
const nodemailer = require('nodemailer');
require('dotenv').config();

// PayPal environment setup
const environment = new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
const client = new paypal.core.PayPalHttpClient(environment);

const bookingsController = (Booking) => {

  const calculatePrice = (startDate, endDate, pricePerDay) => {
    const duration = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
    const totalAmount = duration * pricePerDay;
    return { duration, totalAmount };
  };

  // Create a PayPal order
  const createPaymentIntent = async (req, res) => {
    const { listingId, startDate, endDate, currency = 'USD' } = req.body;

    try {
      const listing = await Listing.findById(listingId);
      if (!listing) return res.status(404).json({ error: 'Listing not found.' });

      const {totalAmount} = calculatePrice(startDate, endDate, listing.price);

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: totalAmount.toFixed(2),
          },
          custom_id: req.user.id,
          description: `Booking for ${listing.title} from ${startDate} to ${endDate}`,
        }]
      });

      const order = await client.execute(request);

      res.status(200).json({
        orderId: order.result.id,
        amount: totalAmount,
      });

    } catch (err) {
      console.error('PayPal error:', err.message);
      res.status(500).json({ error: err.message });
    }
  };

  const bookListing = async (req, res) => {
    const { listingId, startDate, endDate } = req.body;
    const userId = req.user.id;

    try {
      const listing = await Listing.findById(listingId);
      if (!listing) return res.status(404).json({ error: 'Listing not found.' });

      const conflictingBooking = await Booking.findOne({
        listingId,
        $or: [
          { startDate: { $lt: endDate }, endDate: { $gt: startDate } },
        ],
      });

      if (conflictingBooking) {
        return res.status(400).json({ error: 'Selected dates are unavailable.' });
      }

      const { totalAmount } = calculatePrice(startDate, endDate, listing.price);

      const newBooking = new Booking({
        userId,
        listingId,
        startDate,
        endDate,
        totalPrice: totalAmount,
      });

      await newBooking.save();
      sendBookingNotification(userId, listing.createdBy, listing.title, startDate, endDate);

      res.status(201).json({
        message: 'Booking successful!',
        bookingId: newBooking._id,
        totalPrice: totalAmount,
      });

    } catch (error) {
      res.status(500).json({ error: 'Server error: ' + error.message });
    }
  };

  const sendBookingNotification = async (userEmail, hostId, listingTitle, startDate, endDate) => {
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `New Booking: ${listingTitle}`,
      text: `Your unit - "${listingTitle}" has been booked from ${startDate} to ${endDate}.`,
    };

    await transporter.sendMail(mailOptions);
  };

  return { createPayPalOrder: createPaymentIntent, bookListing };
};

module.exports = bookingsController;
