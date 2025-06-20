const mongoose = require('mongoose');

const youtubeUploadHistorySchema = new mongoose.Schema({
  youtubeAccountId: { type: String, required: true, index: true },
  videoId: { type: String, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  tags: [{ type: String }],
  privacyStatus: { type: String, enum: ['private', 'unlisted', 'public'], default: 'private' },
  categoryId: { type: String, default: '22' },
  channelId: { type: String },
  channelTitle: { type: String },
  publishedAt: { type: Date },
  thumbnailUrl: { type: String },
  uploadedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  uploadTime: { type: Date, default: Date.now },
  youtubeUrl: { type: String },
  status: { 
    type: String, 
    enum: ['completed', 'failed', 'scheduled', 'uploaded', 'processing'],
    default: 'completed'
  },
  error: { type: String },
  scheduledTime: { type: Date },
  updatedAt: { type: Date, default: Date.now }
});

// 创建复合索引
youtubeUploadHistorySchema.index({ youtubeAccountId: 1, uploadTime: -1 });

youtubeUploadHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('YoutubeUploadHistory', youtubeUploadHistorySchema); 