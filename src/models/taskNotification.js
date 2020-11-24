const mongoose = require("mongoose");

const { Schema } = mongoose;

const taskNotificationSchema = new Schema({
  message: { type: String },
  taskName: { type: String, required: true },
  taskNum: { type: String },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: "userProfile",
    required: true,
  },
  taskId: { type: Schema.Types.ObjectId, ref: "task", required: true },
  isRead: { type: Boolean, default: false },
  eventType: { type: String },
  dateCreated: { type: Date, default: Date.now() },
  dateRead: { type: Date, default: null },
  oldTaskInfos: {
    oldWhyInfo: { type: String, default: "" },
    oldIntentInfo: { type: String, default: "" },
    oldEndstateInfo: { type: String, default: "" },
  },
  newTaskInfos: {
    newWhyInfo: { type: String, default: "" },
    newIntentInfo: { type: String, default: "" },
    newEndstateInfo: { type: String, default: "" },
  },
});

module.exports = mongoose.model(
  "taskNotification",
  taskNotificationSchema,
  "taskNotifications"
);
