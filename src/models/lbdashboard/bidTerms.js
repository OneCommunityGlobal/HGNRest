const mongoose = require('mongoose');

const { Schema } = mongoose;

const bidTermsSchema = new Schema({
  content: { type: String, required: true },
  cancellationPolicy: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
});

module.exports = mongoose.model('BidTerms', bidTermsSchema, 'bidTerms');
