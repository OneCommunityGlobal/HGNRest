const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true
  },
  property_id: {
    type: String,
    required: true
  },
  bid_amount: {
    type: String,
    required: true
  },
  start_date: {
    type: String,
    required: true
  },
});

module.exports = mongoose.model('bidoverview_Bid', bidSchema, "bidoverview_Bids");