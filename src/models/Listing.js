const mongoose = require("mongoose");

const ListingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  location: { type: String, required: true },
  bedrooms: { type: Number, required: true },
  bathrooms: { type: Number, required: true },
  squareFeet: { type: Number, required: true },
  images: [{ type: String }],  // Array of image URLs (S3 or local)
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Listing", ListingSchema);
