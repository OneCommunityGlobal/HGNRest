const mongoose = require('mongoose');

const { Schema } = mongoose;

const LessonPlanTemplateSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  ageBand: {
    type: String,
    enum: ['EarlyYears', 'Primary', 'Middle', 'High'],
    required: true,
  },

  subjectTags: [String],

  description: String,

  bullets: [
    {
      title: String,
      description: String,
      suggestions: [String],
    },
  ],

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
  },

  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('LessonPlanTemplate', LessonPlanTemplateSchema);
