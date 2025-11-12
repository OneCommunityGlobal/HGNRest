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
      bookingUserId: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    }
  ],
  blockedOutDates: [
    {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
      reason: { type: String }, 
      blockedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    }
  ],
  lastUpdated: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('availabilityCalendar', availabilityCalendar, 'availabilityCalendar');
