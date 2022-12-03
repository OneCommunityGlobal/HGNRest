const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectSchema = new Schema({
  projectName: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  createdDateTime: { type: Date },
  modifiedDateTime: { type: Date, default: Date.now() },
  category: { type: String, enum: ['Food', 'Energy', 'Housing', 'Education', 'Society', 'Economics', 'Stewardship', 'Other', 'Unspecified'], default: 'Other' },
});

module.exports = mongoose.model('project', projectSchema, 'projects');
