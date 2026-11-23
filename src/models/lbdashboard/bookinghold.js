const mongoose = require('mongoose');

const bookingHoldSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paypalOrderId: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // TTL index
});

bookingHoldSchema.index({ listingId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('BookingHold', bookingHoldSchema);
