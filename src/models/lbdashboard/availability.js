const mongoose = require('mongoose');

const { Schema } = mongoose;

const availabilityCalendar = new Schema({
  listingId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'listings',
    required: true,
    index: true,
  },
  bookedDates: [
    {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
      bookingId: { type: mongoose.SchemaTypes.ObjectId, ref: 'bookings' }, 
    }
  ],
  pendingReservations: [
    {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
      reservationId: { type: mongoose.SchemaTypes.ObjectId, ref: 'reservations' }, 
    }
  ],
  blockedOutDates: [
    {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
      reason: { type: String }, 
    }
  ],
  lastUpdated: {
    type: Date,
    default: Date.now,
  }
});

availabilityCalendar.index({ listingId: 1 });

module.exports = mongoose.model('availabilityCalendar', availabilityCalendar, 'availabilityCalendar');
