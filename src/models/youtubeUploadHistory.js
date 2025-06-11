const mongoose = require('mongoose');

const youtubeUploadHistorySchema = new mongoose.Schema({
  youtubeAccountId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  tags: [String],
  privacyStatus: { type: String, default: 'private' },
  videoId: { type: String },
  status: { 
    type: String, 
    enum: ['completed', 'failed', 'scheduled'],
    default: 'completed'
  },
  error: { type: String },
  scheduledTime: { type: Date },
  uploadTime: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

youtubeUploadHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('YoutubeUploadHistory', youtubeUploadHistorySchema); 