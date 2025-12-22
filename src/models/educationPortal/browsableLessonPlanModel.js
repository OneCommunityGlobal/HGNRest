const mongoose = require('mongoose');

const BrowsableLessonPlanSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200, index: true },
    description: { type: String, trim: true, maxlength: 1000 },
    subjects: [{ type: String, trim: true, lowercase: true, index: true }],
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
      index: true,
    },
    tags: [{ type: String, trim: true, lowercase: true, index: true }],
    content: { type: String },
    thumbnail: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile', index: true },
    featured: { type: Boolean, default: false, index: true },
    published: { type: Boolean, default: true, index: true },
    savedCount: { type: Number, default: 0, min: 0 },
    views: { type: Number, default: 0, min: 0 },
    estimatedDuration: { type: Number }, // in minutes
    targetAgeRange: { min: Number, max: Number },
    prerequisites: [{ type: String }],
    learningObjectives: [{ type: String }],
    materials: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Text index for search functionality
BrowsableLessonPlanSchema.index({
  title: 'text',
  description: 'text',
  content: 'text',
  tags: 'text',
  subjects: 'text',
});

BrowsableLessonPlanSchema.index({ difficulty: 1, createdAt: -1 });
BrowsableLessonPlanSchema.index({ subjects: 1, difficulty: 1 });
BrowsableLessonPlanSchema.index({ featured: 1, createdAt: -1 });
BrowsableLessonPlanSchema.index({ savedCount: -1 });
BrowsableLessonPlanSchema.index({ views: -1 });

module.exports = mongoose.model('BrowsableLessonPlan', BrowsableLessonPlanSchema, 'browsableLessonPlans');