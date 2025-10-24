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
  availableFrom: { type: Date },
  availableTo: { type: Date },
  updatedOn: { type: Date, required: true, default: Date.now },
  updatedBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  status: { type: String, required: true, enum: ['draft', 'complete'], default: 'draft' },
  village: { type: String },
  coordinates: {
    type: [Number],  // Format: [longitude, latitude]
    index: '2dsphere'
  }
});

listings.path('coordinates').validate((value) => {
  if (!value || value.length !== 2) {
    return false;
  }

  const [longitude, latitude] = value;
  return (
    typeof longitude === 'number' && 
    typeof latitude === 'number' && 
    longitude >= -180 && longitude <= 180 && 
    latitude >= -90 && latitude <= 90
  );
}, 'Coordinates must be in [longitude, latitude] format and within valid ranges');

listings.index({ price: -1 });
listings.index({ price: 1 });
listings.index({ createdOn: -1 });
listings.index({ createdOn: 1 });
listings.index({ village: 1 });
listings.index({ availableFrom: 1 });
listings.index({ availableTo: 1 });

module.exports = mongoose.model('listings', listings, 'listings');
