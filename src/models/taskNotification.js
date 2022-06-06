const mongoose = require('mongoose');

const { Schema } = mongoose;

const SECONDS_IN_MONTH = 2419200;

const taskNotificationSchema = new Schema({
  message: { type: String },
  taskName: { type: String, required: true },
  taskNum: { type: String },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  taskId: { type: Schema.Types.ObjectId, ref: 'task', required: true },
  isAcknowleged: { type: Number, default: 0 },
  eventType: { type: String },
  dateCreated: { type: Date, default: Date.now(), expires: SECONDS_IN_MONTH },
  oldWhyInfo: { type: String, default: '' },
  oldIntentInfo: { type: String, default: '' },
  oldEndstateInfo: { type: String, default: '' },
});

module.exports = mongoose.model(
  'taskNotification',
  taskNotificationSchema,
  'taskNotifications',
);
