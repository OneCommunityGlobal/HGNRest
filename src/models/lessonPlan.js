const mongoose = require('mongoose');

const lessonPlanSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    theme: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
    },
    // needs to be removed- not as per requirements
    activities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
      },
    ],
    atomTasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AtomTaskTemplate',
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('LessonPlan', lessonPlanSchema);
