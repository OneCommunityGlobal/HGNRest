const mongoose = require('mongoose');

const { Schema } = mongoose;

const listingsSchema = new Schema({
  amenities: { type: String, required: true },
  status: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: mongoose.SchemaTypes.Decimal128, required: true },
  perUnit: { type: String, required: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
});

module.exports = mongoose.model('Listings', listingsSchema, 'listings');
