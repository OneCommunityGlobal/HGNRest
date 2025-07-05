const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  lessonPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LessonPlan',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  atomTaskTemplates: [{
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    atomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Atom',
      required: true
    },
    taskType: {
      type: String,
      required: true,
      enum: ['read', 'write', 'practice', 'quiz', 'project']
    },
    instructions: {
      type: String,
      required: true,
      trim: true
    },
    resources: [{
      type: String,
      trim: true
    }]
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Activity', activitySchema); 