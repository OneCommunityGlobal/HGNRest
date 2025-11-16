const mongoose = require('mongoose');

const epBadgeSchema = new mongoose.Schema(
  {
    badge_id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    image_url: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['capstone', 'lesson_completion', 'achievement', 'milestone'],
      default: 'achievement',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('epBadge', epBadgeSchema);