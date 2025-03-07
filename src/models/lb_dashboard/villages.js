const mongoose = require('mongoose');

const villageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  regionId: {
    type: String,
    required: true,
    enum: ['C', '1', '2', '3', '4', '5', '6', '7'],
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  listingLink: {
    type: String,
    required: false,
  },
  descriptionLink: {
    type: String,
    required: false,
  },
  imageLink: {
    type: String,
    required: false
  },
  
  mapCoordinates: {
    shapeType: {
      type: String,
      enum: ['rect', 'circle', 'poly']
    },
    coordinates: String
  },
  properties: [{
    name: String,
    description: String,
    link: String
  }]
});

const Village = mongoose.model('Village', villageSchema);

module.exports = Village;