const mongoose = require('mongoose');

const { Schema } = mongoose;

const ProjectSchema = new Schema({
  projectId: { type: mongoose.SchemaTypes.ObjectId, ref: 'projects' },
  projectName: { type: String },
  category: { type: String },
});

const userProjectSchema = new Schema({

  _id: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  projects: [ProjectSchema],
});

module.exports = mongoose.model('userProject', userProjectSchema, 'userProjects');
