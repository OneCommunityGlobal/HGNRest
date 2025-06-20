const mongoose = require('mongoose');

const youtubeUploadHistorySchema = new mongoose.Schema({
  youtubeAccountId: { type: String, required: true, index: true },
  videoId: { type: String, required: true, unique: true },
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
  uploadDate: { type: Date, default: Date.now },
  youtubeUrl: { type: String },
  status: { type: String, enum: ['uploaded', 'processing', 'failed'], default: 'uploaded' }
});

// 创建复合索引
youtubeUploadHistorySchema.index({ youtubeAccountId: 1, uploadDate: -1 });

module.exports = mongoose.model('YoutubeUploadHistory', youtubeUploadHistorySchema); 