const mongoose = require('mongoose');

const BrowsableLessonPlanSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true },
    subjects: [{ type: String, trim: true }],
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    tags: [{ type: String, trim: true }],
    content: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile' },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BrowsableLessonPlan', BrowsableLessonPlanSchema);