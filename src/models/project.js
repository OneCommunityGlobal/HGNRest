const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectschema = new Schema({
  projectName: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
});

module.exports = mongoose.model('project', projectschema, 'projects');
