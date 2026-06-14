const mongoose = require('mongoose');

const { Schema } = mongoose;

const fields = {
  content: { type: String, required: true, maxlength: 280 },
  scheduledAt: { type: Date, required: true },
  mediaBase64: { type: String, default: null },
  altText: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'ready', 'posted', 'skipped'],
    default: 'pending',
  },
  postedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
};

const xScheduledPostSchema = new Schema(fields, { timestamps: true });

xScheduledPostSchema.index({ scheduledAt: 1 });

module.exports =
  mongoose.models.XScheduledPost || mongoose.model('XScheduledPost', xScheduledPostSchema);
