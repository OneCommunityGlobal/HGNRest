const mongoose = require('mongoose');

const villageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    select: true
  },
  regionId: {
    type: String,
    required: true,
    enum: ['C', '1', '2', '3', '4', '5', '6', '7'],
    unique: true,
    select: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    select: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    select: true
  },
  listingLinks: [{
    name: String,
    url: String
  }],
  description: {
    type: String,
    required: false,
    select: true
  },
  imageLink: {
    type: String,
    required: false,
    select: true
  },
  position: {
    top: {
      type: String,
      required: false,
      select: true
    },
    left: {
      type: String,
      required: false,
      select: true
    }
  },
  properties: [{
    name: String,
    description: String,
    link: String
  }]
});

const Village = mongoose.model('Village', villageSchema);

module.exports = Village;