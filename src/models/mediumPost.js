const mongoose = require('mongoose');

const MediumPostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String, // HTML or Markdown
    required: true,
  },
  tags: {
    type: [String],
    default: [],
    validate: [tagsLimit, '{PATH} exceeds the limit of 5']
  },
  summary: {
    type: String,
  },
  aiHashtags: {
    type: [String],
  },
  imageUrls: {
    type: [String], // only allow image URLs if image support is enabled
    default: [],
  },
  platform: {
    type: String,
    default: 'medium',
    enum: ['medium'],
  },
  scheduledDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['scheduled', 'posted', 'failed'],
    default: 'scheduled',
  },
  failureReason: {
    type: String,
    default: '',
  },
  notificationEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/.+\@.+\..+/, 'Please enter a valid email'],
  },
  bestPracticesNote: {
    type: String,
    default: `✔ Use relevant hashtags
✔ Include a summary
✔ Images perform better
✔ Keep the title under 100 characters`
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

function tagsLimit(val) {
  return val.length <= 5;
}

module.exports = mongoose.model('MediumPost', MediumPostSchema);
