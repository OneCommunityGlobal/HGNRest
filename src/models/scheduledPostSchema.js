const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const scheduledPostSchema = new mongoose.Schema({
  postId: {
    type: String,
    default: uuidv4, // Generate a UUID for each post
    unique: true,
  },
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
    enum: ['twitter', 'facebook'],
    required: true,
  },
  status: {
    type: String,
    enum: ['scheduled', 'posted'],
    default: 'scheduled',
  },
  createdBy: {
    type: String,
    required: false,
  },
  updatedBy: {
    type: String,
    required: false,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ScheduledPost', scheduledPostSchema);
