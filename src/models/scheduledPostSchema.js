const mongoose = require('mongoose');

const scheduledPostSchema = new mongoose.Schema({
  textContent: {
    type: String,
    required: false,
  },
  urlSrcs: {
    type: [String],
    required: false,
  },
  base64Srcs: {
    type: [String],
    required: false,
  },
  scheduledTime: {
    type: Date,
    required: true,
  },
  platform: {
    type: String,
    enum: ['twitter'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ScheduledPost', scheduledPostSchema);
