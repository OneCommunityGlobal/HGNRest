const mongoose = require('mongoose');

const atomSchema = new mongoose.Schema({
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  prerequisites: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Atom',
    },
  ],
  learningStrategies: [
    {
      type: String,
      trim: true,
    },
  ],
  learningTools: [
    {
      type: String,
      trim: true,
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Atom', atomSchema);
