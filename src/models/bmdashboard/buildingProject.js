const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingProject = new Schema({
  isActive: { type: Boolean, default: true },
  name: { type: String, required: true, trim: true },
  template: String, // construction template (ie Earthbag Village)
  location: String, // Legacy display field; address/city are the structured fields.
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  country: { type: String, trim: true },
  region: { type: String, trim: true },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  status: {
    type: String,
    enum: ['active', 'delayed', 'completed'],
    default: 'active',
  },
  startDate: Date,
  endDate: Date,
  dateCreated: { type: Date, default: Date.now },
  buildingManager: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  teams: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'teams' }], // teams assigned to the project
  members: [
    {
      user: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      hours: { type: Number, default: 0 }, // tracked via the Member Check-In Page timer
    },
  ],
  projectType: { type: String, enum: ['commercial', 'residential', 'private'], default: 'private' },
});

module.exports = mongoose.model('buildingProject', buildingProject, 'buildingProjects');
