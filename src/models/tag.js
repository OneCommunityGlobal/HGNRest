const mongoose = require('mongoose');

const { Schema } = mongoose;

const tagSchema = new Schema({
  tagId: {
    type: String,
    required: true,
    unique: true
  },
  tagName: {
    type: String,
    required: true,
    index: true
  },
  projectId: {
    type: String,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  frequency: {
    type: Number,
    default: 0
  }
});

tagSchema.index({ projectId: 1, createdAt: 1 });
tagSchema.index({ tagName: 1, projectId: 1 });

module.exports = mongoose.model('Tag', tagSchema);