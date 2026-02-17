const mongoose = require('mongoose');

const { Schema } = mongoose;

const bookingsModel = new Schema({
  userId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  listingId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'listings',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative'],
  },
  paypalOrderId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'confirmed',
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  updatedOn: {
    type: Date,
    default: Date.now,
  },
});

bookingsModel.index({ listingId: 1, startDate: 1, endDate: 1 });
bookingsModel.index({ userId: 1 });
bookingsModel.index({ paypalOrderId: 1 }, { unique: true });

bookingsModel.pre('save', function (next) {
  this.updatedOn = Date.now();
  next();
});

module.exports = mongoose.model('Booking', bookingsModel);
