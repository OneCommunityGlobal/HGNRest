const mongoose = require('mongoose');

const { Schema } = mongoose;

const bidNotificationSchema = new Schema({
  userId: { type: mongoose.SchemaTypes.ObjectId, ref: 'users', required: true },
  message: { type: String, required: true },
  isDelivered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now() },
  modifiedAt: { type: Date, default: Date.now() },
});

module.exports = mongoose.model('BidNotifications', bidNotificationSchema, 'bidnotifications');
