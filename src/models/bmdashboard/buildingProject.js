const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingProject = new Schema({
  isActive: Boolean,
  name: String,
  template: String, // construction template (ie Earthbag Village)
  location: String, // use lat/lng instead?
  dateCreated: { type: Date, default: Date.now },
  buildingManager: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  members: [{
    user: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    team: { type: mongoose.SchemaTypes.ObjectId, ref: 'teams' },
    hours: { type: Number, default: 0 }, // tracked via the Member Check-In Page timer
  }],
});

module.exports = mongoose.model('buildingProject', buildingProject, 'buildingProjects');
