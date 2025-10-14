const mongoose = require('mongoose');

const { Schema } = mongoose;

const bookingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'userProfile', required: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'listings', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalPrice: { type: Number, required: true },
  createdOn: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Booking', bookingSchema);
