const mongoose = require('mongoose');

const { Schema } = mongoose;
const projectMaterialSchema = new Schema({
  //   projectId: {
  //     type: String,
  //     required: true,
  //     unique: true,
  //   },
  projectName: {
    type: String,
    required: true,
  },
  toolName: {
    type: String,
    required: true,
  },
  replacedPercentage: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model('ProjectMaterial', projectMaterialSchema, 'projectmaterialcosts');
