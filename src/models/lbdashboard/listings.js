const mongoose = require('mongoose');

const { Schema } = mongoose;

const listings = new Schema({
  title: { type: String, required: true, maxLength: 255 },
  price: { type: Number, required: true },
  createdOn: { type: Date, required: true, default: Date.now },
  createdBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  perUnit: { type: String, required: true },
  description: { type: String },
  images: { type: [String] },
  amenities: { type: [String] },
  availability: { type: Date },
  updatedOn: { type: Date, required: true, default: Date.now },
  updatedBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  status: { type: String, required: true, enum: ['draft', 'complete'], default: 'draft' },
});

listings.index({ price: -1 });
listings.index({ price: 1 });
listings.index({ createdOn: -1 });
listings.index({ createdOn: 1 });

module.exports = mongoose.model('listings', listings, 'listings');
