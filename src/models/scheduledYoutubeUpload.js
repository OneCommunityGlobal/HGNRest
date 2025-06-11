const mongoose = require('mongoose');

const scheduledYoutubeUploadSchema = new mongoose.Schema({
  youtubeAccountId: { type: String, required: true },
  videoPath: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  tags: [String],
  privacyStatus: { type: String, default: 'private' },
  scheduledTime: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 更新时间中间件
scheduledYoutubeUploadSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ScheduledYoutubeUpload', scheduledYoutubeUploadSchema); 