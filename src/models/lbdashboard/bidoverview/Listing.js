const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  description: { type: String, required: true },
  images: { type: [String], required: true },
  amenities: { type: [String], required: true },
  price: { type: String, required: true },
});

module.exports = mongoose.model('bidoverview_Listing', propertySchema, "bidoverview_Listings");