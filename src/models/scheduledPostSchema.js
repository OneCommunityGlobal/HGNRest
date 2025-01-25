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
  scheduledDate: {
    type: String, // mm/dd/yyyy
    required: true,
  },
  scheduledTime: {
    type: String, // hr:min AM/PM
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
