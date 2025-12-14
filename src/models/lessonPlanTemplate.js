const mongoose = require('mongoose');

const { Schema } = mongoose;

const LessonPlanTemplateSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },

  ageBand: {
    type: String,
    required: true,
  },

  duration: {
    type: String,
    required: true,
  },
  theme: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    required: true,
  },
  subjectTags: {
    type: [Schema.Types.ObjectId],
    ref: 'Subject',
    required: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
  },

  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('LessonPlanTemplate', LessonPlanTemplateSchema);
