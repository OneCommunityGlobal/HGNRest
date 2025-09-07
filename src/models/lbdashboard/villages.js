const mongoose = require('mongoose');

const villageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    select: true,
  },
  regionId: {
    type: String,
    required: true,
    enum: ['C', '1', '2', '3', '4', '5', '6', '7'],
    unique: true,
    select: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    select: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    select: true,
  },
  listingLinks: [
    {
      name: String,
      url: String,
    },
  ],
  description: {
    type: String,
    required: false,
    select: true,
  },
  imageLink: {
    type: String,
    required: false,
    select: true,
  },
  position: {
    top: {
      type: String,
      required: false,
      select: true,
    },
    left: {
      type: String,
      required: false,
      select: true,
    },
  },
  properties: [
    {
      unit: { type: Number, default: 101 },
      currentBid: { type: Number, default: 0 },
      link: String,
      description: String,
    },
  ],
  // links to individual village map image
  villageMapLink: {
    type: String,
    default: '',
    required: false,
    select: true,
  },
  // new: list of amenities available in this village
  amenities: {
    type: [String],
    default: [],
  },
});

const Village = mongoose.model('Village', villageSchema);

module.exports = Village;
