const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  user_id: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
  property_id: { type: mongoose.SchemaTypes.ObjectId, ref: 'bidListing', required: true },
  name: { type: String },
  bid_amount: { type: Number, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  createdOn: { type: Date, default: Date.now },
});

module.exports = mongoose.model('bidoverview_Bid', bidSchema, 'bidoverview_Bids');
