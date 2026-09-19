const mongoose = require('mongoose');

const epBadgeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Badge name is required'],
      trim: true,
      minlength: [2, 'Badge name must be at least 2 characters'],
      maxlength: [100, 'Badge name cannot exceed 100 characters'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    image_url: {
      type: String,
      required: [true, 'Image URL is required'],
      validate: {
        validator(v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Image URL must be a valid HTTP/HTTPS URL',
      },
    },
    category: {
      type: String,
      enum: {
        values: ['capstone', 'lesson_completion', 'achievement', 'milestone'],
        message: '{VALUE} is not a valid category',
      },
      default: 'achievement',
      index: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    points: {
      type: Number,
      default: 0,
      min: [0, 'Points cannot be negative'],
      max: [10000, 'Points cannot exceed 10000'],
    },
    ranking: {
      type: Number,
      default: 0,
      min: 0,
    },
    allow_multiple: {
      type: Boolean,
      default: false,
      description: 'Whether a student can earn this badge multiple times',
    },
    criteria: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Custom criteria for automatic badge awarding',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Additional badge metadata',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for performance
epBadgeSchema.index({ name: 1, is_active: 1 });
epBadgeSchema.index({ category: 1, is_active: 1 });
epBadgeSchema.index({ ranking: 1, createdAt: -1 });

// Virtual for awarded count
epBadgeSchema.virtual('awardedCount', {
  ref: 'studentBadges',
  localField: '_id',
  foreignField: 'badge_id',
  count: true,
});

// Pre-save middleware
epBadgeSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  next();
});

// Instance methods
epBadgeSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Static methods
epBadgeSchema.statics.findActive = function () {
  return this.find({ is_active: true });
};

epBadgeSchema.statics.findByCategory = function (category) {
  return this.find({ category, is_active: true });
};

module.exports = mongoose.model('epBadge', epBadgeSchema, 'epbadges');
