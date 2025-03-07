const mongoose = require('mongoose');

const villageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
    required: true,
  },
  descriptionLink: {
    type: String,
    required: true,
  },
  imageLink: {
    type: String,
    required: true
  },
  
  mapCoordinates: {
    shapeType:{
        type: String,
        enum: ['rect','circke','poly']
    },
    coordinates: String
}
});

const Village = mongoose.model('Village',villageSchema);

module.exports = Village;