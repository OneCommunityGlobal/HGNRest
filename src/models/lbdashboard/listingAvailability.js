const mongoose = require('mongoose');

const { Schema } = mongoose;

const listingAvailability = new Schema({
  listingId: { type: mongoose.SchemaTypes.ObjectId, ref: 'listings', required: true },
  rentingFrom: { type: Date, required: true },
  rentingTill: { type: Date, required: true },
});

listingAvailability.index({ listingId: 1 });
listingAvailability.index({ rentingFrom: 1 });
listingAvailability.index({ rentingTill: 1 });

module.exports = mongoose.model('listingAvailability', listingAvailability, 'listingAvailability');
