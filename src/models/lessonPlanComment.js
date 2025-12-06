const mongoose = require('mongoose');

const { Schema } = mongoose;

const LessonPlanCommentSchema = new Schema({
  draftId: {
    type: Schema.Types.ObjectId,
    ref: 'LessonPlanDraft',
    required: true,
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },

  message: {
    type: String,
    required: true,
  },

  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'LessonPlanDraftItem',
    default: null,
  },

  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('LessonPlanComment', LessonPlanCommentSchema);
