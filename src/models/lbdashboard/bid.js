const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  listing_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'listings',
    required: true,
  },
  bid_amount: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  bid_status: {
    type: String,
    enum: ['accepted', 'won'],
    required: true,
  },
});

module.exports = mongoose.model('bids', bidSchema, 'bids');
