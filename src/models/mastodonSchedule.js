const mongoose = require('mongoose');

const { Schema } = mongoose;

// Delivery state for a scheduled post:
// pending -> publishing (claimed by one worker) -> posted | failed.
// Records created before this field existed have no status and are
// treated as pending.
const DELIVERY_STATUSES = ['pending', 'publishing', 'posted', 'failed'];

const mastodonSchedule = new Schema({
  postData: { type: String, required: true },
  scheduledTime: { type: Date, required: true },
  status: { type: String, enum: DELIVERY_STATUSES, default: 'pending' },
  lockOwner: { type: String },
  lockedUntil: { type: Date },
  attempts: { type: Number, default: 0 },
  remoteStatusId: { type: String },
  postedAt: { type: Date },
  lastError: { type: String },
});

mastodonSchedule.index({ status: 1, scheduledTime: 1 });

module.exports = mongoose.model('mastodonSchedule', mastodonSchedule);
module.exports.DELIVERY_STATUSES = DELIVERY_STATUSES;
