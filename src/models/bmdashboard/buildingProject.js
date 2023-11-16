const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingProject = new Schema({
  isActive: Boolean,
  name: String,
  template: String, // construction template (ie Earthbag Village)
  location: String, // use lat/lng instead?
  dateCreated: { type: Date, default: Date.now },
  buildingManager: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' }, // BM's id
  team: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' }],
});

module.exports = mongoose.model('buildingProject', buildingProject, 'buildingProjects');
