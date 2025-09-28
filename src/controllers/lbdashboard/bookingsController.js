const mongoose = require('mongoose');
const paypal = require('@paypal/paypal-server-sdk');
const nodemailer = require('nodemailer');
require('dotenv').config();

// PayPal environment setup
const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

const bookingsController = (Booking, Listing) => {

    // Calculate total booking price
    const calculatePrice = (startDate, endDate, pricePerDay) => {
        const duration = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
        const totalAmount = duration * pricePerDay;
        return { duration, totalAmount };
    };

    // Create PayPal order
    const createPaymentIntent = async (req, res) => {
        const { listingId, startDate, endDate, currency = 'USD' } = req.body;

        try {
            const listing = await Listing.findById(listingId);
            if (!listing) return res.status(404).json({ error: 'Listing not found.' });

            const { totalAmount } = calculatePrice(startDate, endDate, listing.price);

            const request = new paypal.orders.OrdersCreateRequest();

            const userId = req.body?.requestor?.requestorId;

            if (!userId) {
                return res.status(401).json({ error: 'Missing user ID from token' });
            }
            request.prefer("return=representation");
            request.requestBody({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: currency,
                        value: totalAmount.toFixed(2),
                    },
                    custom_id: "67996cca2f3835004da53b03",
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

    // Create a booking record and send notifications
    const bookListing = async (req, res) => {
        const { listingId, startDate, endDate } = req.body;
        const userId = req.user.id;

        try {
            const listing = await Listing.findById(listingId);
            if (!listing) return res.status(404).json({ error: 'Listing not found.' });

            // Check for date conflicts
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

            // Send email notifications (to user and listing owner)
            sendBookingNotification(req.user.email, listing.createdByEmail, listing.title, startDate, endDate);

            res.status(201).json({
                message: 'Booking successful!',
                bookingId: newBooking._id,
                totalPrice: totalAmount,
            });

        } catch (error) {
            console.error('Booking error:', error);
            res.status(500).json({ error: 'Server error: ' + error.message });
        }
    };

    // Email notification to user and host
    const sendBookingNotification = async (userEmail, hostEmail, listingTitle, startDate, endDate) => {
        try {
            const transporter = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            // Email to user
            const userMailOptions = {
                from: process.env.EMAIL_USER,
                to: userEmail,
                subject: `Booking Confirmed: ${listingTitle}`,
                text: `Your booking for "${listingTitle}" from ${startDate} to ${endDate} has been confirmed.`,
            };

            // Email to host
            const hostMailOptions = {
                from: process.env.EMAIL_USER,
                to: hostEmail,
                subject: `New Booking: ${listingTitle}`,
                text: `Your listing "${listingTitle}" has been booked from ${startDate} to ${endDate}.`,
            };

            await transporter.sendMail(userMailOptions);
            await transporter.sendMail(hostMailOptions);

        } catch (err) {
            console.error('Email notification error:', err);
        }
    };

    return { createPaymentIntent, bookListing };
};

module.exports = bookingsController;
