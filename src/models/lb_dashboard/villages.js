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
  listingLink: {
    type: String,
    required: false,
    select: true
  },
  descriptionLink: {
    type: String,
    required: false,
    select: true
  },
  imageLink: {
    type: String,
    required: false,
    select: true
  },
  
  mapCoordinates: {
    type: {
      shapeType: {
        type: String,
        enum: ['rect', 'circle', 'poly'],
        required: false,
        select: true
      },
      coordinates: {
        type: String,
        required: false,
        select: true
      }
    },
    required: false,
    select: true
  },
  properties: [{
    name: String,
    description: String,
    link: String
  }]
});

const Village = mongoose.model('Village', villageSchema);

module.exports = Village;