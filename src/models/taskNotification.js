const mongoose = require('mongoose');

const { Schema } = mongoose;

const SECONDS_IN_MONTH = 2419200;

const taskNotificationSchema = new Schema({
  message: { type: String },
  taskName: { type: String, required: true },
  taskNum: { type: String },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  taskId: { type: Schema.Types.ObjectId, ref: 'task', required: true },
  readStatus: { type: Number, default: 0 }, // 0: unread, 1: read but not acknowleged, 2: read and acknowledged
  eventType: { type: String },
  dateCreated: { type: Date, default: Date.now(), expires: SECONDS_IN_MONTH },
  dateRead: { type: Date, default: null },
  oldTaskInfos: {
    oldWhyInfo: { type: String, default: '' },
    oldIntentInfo: { type: String, default: '' },
    oldEndstateInfo: { type: String, default: '' },
  },
  newTaskInfos: {
    newWhyInfo: { type: String, default: '' },
    newIntentInfo: { type: String, default: '' },
    newEndstateInfo: { type: String, default: '' },
  },
});

module.exports = mongoose.model(
  'taskNotification',
  taskNotificationSchema,
  'taskNotifications',
);
