const paypal = require('@paypal/checkout-server-sdk');
const nodemailer = require('nodemailer');
const Joi = require('joi');
require('dotenv').config();

const environment =
  process.env.NODE_ENV === 'production'
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET,
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET,
      );

const client = new paypal.core.PayPalHttpClient(environment);

const bookingsController = (Booking, Listing, User) => {
  const calculatePrice = (startDate, endDate, basePrice) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (days <= 0) throw new Error('Invalid date range');
    return { totalAmount: parseFloat((days * basePrice).toFixed(2)), days };
  };

  const sendBookingNotifications = async (bookingId) => {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'email firstName lastName')
        .populate('listingId');

      if (!booking) {
        console.error('Booking not found for notifications');
        return;
      }

      if (!booking.userId?.email) {
        console.error('Guest email not found');
        return;
      }

      const host = await User.findById(booking.listingId.createdBy);
      if (!host?.email) {
        console.error('Host email not found');
        return;
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email credentials not configured');
        return;
      }

      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const formatDate = (date) => new Date(date).toLocaleDateString();

      const guestMailOptions = {
        from: process.env.EMAIL_USER,
        to: booking.userId.email,
        subject: `Booking Confirmed: ${booking.listingId.title}`,
        html: `
          <h2>Booking Confirmed! 🎉</h2>
          <p>Your booking for <strong>"${booking.listingId.title}"</strong> has been confirmed.</p>
          <p><strong>Dates:</strong> ${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}</p>
          <p><strong>Total Amount:</strong> $${booking.totalPrice}</p>
          <p><strong>Booking ID:</strong> ${booking._id}</p>
          <br>
          <p>Thank you for your booking!</p>
        `,
      };

      const hostMailOptions = {
        from: process.env.EMAIL_USER,
        to: host.email,
        subject: `New Booking: ${booking.listingId.title}`,
        html: `
          <h2>New Booking! 🎉</h2>
          <p>Your listing <strong>"${booking.listingId.title}"</strong> has been booked!</p>
          <p><strong>Dates:</strong> ${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}</p>
          <p><strong>Total Amount:</strong> $${booking.totalPrice}</p>
          <p><strong>Guest:</strong> ${booking.userId.firstName} ${booking.userId.lastName}</p>
          <p><strong>Guest Email:</strong> ${booking.userId.email}</p>
          <p><strong>Booking ID:</strong> ${booking._id}</p>
        `,
      };

      await transporter.sendMail(guestMailOptions);
      await transporter.sendMail(hostMailOptions);
    } catch (error) {
      console.error('Email notification error:', error.message);
    }
  };

  const createPaymentIntent = async (req, res) => {
    try {
      const schema = Joi.object({
        listingId: Joi.string().hex().length(24).required().messages({
          'string.hex': 'Invalid listing ID format',
          'string.length': 'Listing ID must be 24 characters',
        }),
        startDate: Joi.date().iso().greater('now').required().messages({
          'date.iso': 'Start date must be in ISO format (YYYY-MM-DD)',
          'date.greater': 'Start date must be in the future',
        }),
        endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
          'date.iso': 'End date must be in ISO format (YYYY-MM-DD)',
          'date.greater': 'End date must be after start date',
        }),
        currency: Joi.string().valid('USD', 'EUR', 'GBP').default('USD'),
      }).unknown(true);

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map((detail) => detail.message),
        });
      }

      const { listingId, startDate, endDate, currency } = value;

      const userId = req.body.requestor?.requestorId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized - User authentication required' });
      }

      const listing = await Listing.findById(listingId);
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      const { totalAmount } = calculatePrice(startDate, endDate, listing.price);

      const startDateSimple = new Date(startDate).toISOString().split('T')[0];
      const endDateSimple = new Date(endDate).toISOString().split('T')[0];

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: totalAmount.toString(),
            },
            description: `Booking for ${listing.title} (${startDate} to ${endDate})`,
            custom_id: `dates|${startDateSimple}|${endDateSimple}|${listingId}`,
          },
        ],
      });

      const order = await client.execute(request);

      res.status(200).json({
        success: true,
        orderId: order.result.id,
        totalAmount,
        listingId,
        currency,
      });
    } catch (err) {
      console.error('PayPal Error:', err.message);

      if (err.statusCode >= 400 && err.statusCode < 500) {
        return res.status(400).json({
          error: 'Payment processing failed',
          details: err.message,
        });
      }

      res.status(500).json({
        error: 'Failed to create payment order',
        details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      });
    }
  };

  const createBooking = async (req, res) => {
    try {
      const schema = Joi.object({
        listingId: Joi.string().hex().length(24).required(),
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().required(),
        paypalOrderId: Joi.string().required(),
      }).unknown(true);

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map((detail) => detail.message),
        });
      }

      const { listingId, startDate, endDate, paypalOrderId } = value;

      const userId = req.body.requestor?.requestorId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized - User authentication required' });
      }

      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDateObj <= today) {
        return res.status(400).json({ error: 'Start date must be in the future' });
      }

      if (endDateObj <= startDateObj) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }

      const paymentRequest = new paypal.orders.OrdersGetRequest(paypalOrderId);
      const paymentDetails = await client.execute(paymentRequest);

      if (!['CREATED', 'COMPLETED'].includes(paymentDetails.result.status)) {
        return res.status(400).json({
          error: `Payment not completed. Status: ${paymentDetails.result.status}`,
        });
      }

      const listing = await Listing.findById(listingId);
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      const paymentAmount = parseFloat(paymentDetails.result.purchase_units[0].amount.value);
      const { totalAmount } = calculatePrice(startDate, endDate, listing.price);

      if (Math.abs(paymentAmount - totalAmount) > 0.01) {
        return res.status(400).json({
          error: 'Payment amount does not match booking amount',
          details: `Paid: $${paymentAmount}, Expected: $${totalAmount}`,
        });
      }

      const customId = paymentDetails.result.purchase_units[0].custom_id;

      if (!customId || !customId.startsWith('dates|')) {
        return res.status(400).json({
          error: 'Invalid payment session',
          details: 'This payment was not created for booking. Please create a new payment session.',
        });
      }

      const parts = customId.split('|');
      if (parts.length !== 4) {
        return res.status(400).json({
          error: 'Payment session format mismatch',
          details: `Payment session data is corrupted. Found ${parts.length} parts, expected 4. Please create a new payment session.`,
        });
      }

      const [, paidStartDate, paidEndDate, paidListingId] = parts;

      if (paidListingId !== listingId) {
        return res.status(400).json({
          error: 'Listing mismatch',
          details: `Payment was created for listing ${paidListingId}, but trying to book listing ${listingId}`,
        });
      }

      const normalizedRequestStart = new Date(startDate).toISOString().split('T')[0];
      const normalizedRequestEnd = new Date(endDate).toISOString().split('T')[0];

      if (paidStartDate !== normalizedRequestStart || paidEndDate !== normalizedRequestEnd) {
        return res.status(400).json({
          error: 'Booking dates do not match payment dates',
          details: `Payment was created for dates: ${paidStartDate} to ${paidEndDate}, but trying to book: ${normalizedRequestStart} to ${normalizedRequestEnd}`,
        });
      }

      const conflict = await Booking.findOne({
        listingId,
        $or: [{ startDate: { $lt: endDateObj }, endDate: { $gt: startDateObj } }],
        status: { $in: ['pending', 'confirmed'] },
      });

      if (conflict) {
        return res.status(400).json({
          error: 'Selected dates are unavailable. Please choose different dates.',
        });
      }

      const newBooking = new Booking({
        userId,
        listingId,
        startDate: startDateObj,
        endDate: endDateObj,
        totalPrice: totalAmount,
        paypalOrderId,
        status: 'confirmed',
      });

      await newBooking.save();

      await sendBookingNotifications(newBooking._id);

      const populatedBooking = await Booking.findById(newBooking._id).populate(
        'listingId',
        'title',
      );

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        bookingId: newBooking._id,
        bookingDetails: {
          listing: populatedBooking.listingId.title,
          dates: {
            startDate: startDateObj,
            endDate: endDateObj,
          },
          totalAmount,
          status: 'confirmed',
        },
      });
    } catch (err) {
      console.error('Booking Error:', err.message);

      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((error) => error.message);
        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }

      if (err.name === 'MongoError' && err.code === 11000) {
        return res.status(400).json({
          error: 'Duplicate booking detected',
        });
      }

      res.status(500).json({
        error: 'Failed to create booking',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  };

  return { createPaymentIntent, createBooking };
};

module.exports = bookingsController;
