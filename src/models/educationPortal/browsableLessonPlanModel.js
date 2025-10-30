const mongoose = require('mongoose');

const BrowsableLessonPlanSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true },
    subjects: [{ type: String, trim: true, index: true }],
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner', index: true },
    tags: [{ type: String, trim: true, index: true }],
    content: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile' },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

BrowsableLessonPlanSchema.index({ title: 'text', description: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.model('BrowsableLessonPlan', BrowsableLessonPlanSchema);