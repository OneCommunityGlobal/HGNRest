const mongoose = require('mongoose');

const { Schema } = mongoose;

const bookings = new Schema({
  listingId: { type: mongoose.SchemaTypes.ObjectId, ref: 'listings', required: true },
  rentingFrom: { type: Date, required: true },
  rentingTill: { type: Date, required: true },
});

bookings.index({ listingId: 1 });
bookings.index({ rentingFrom: 1 });
bookings.index({ rentingTill: 1 });

module.exports = mongoose.model('bookings', bookings, 'bookings');
