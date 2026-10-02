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
  oldTask: {
    taskName: { type: String, required: true },
    priority: { type: String, default: 'Primary' },
    resources: [
      {
        name: { type: String, required: true },
        userID: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfiles' },
        profilePic: { type: String },
        completedTask: { type: Boolean, default: false },
      },
    ],
    isAssigned: { type: Boolean, default: true },
    status: { type: String, default: 'Not Started' },
    hoursBest: { type: Number, default: 0.0 },
    hoursWorst: { type: Number, default: 0.0 },
    hoursMost: { type: Number, default: 0.0 },
    estimatedHours: { type: Number, default: 0.0 },
    links: [String],
    classification: { type: String },
    whyInfo: { type: String, default: '' },
    intentInfo: { type: String, default: '' },
    endstateInfo: { type: String, default: '' },
    startedDatetime: { type: Date },
    dueDatetime: { type: Date },
  },
});

module.exports = mongoose.model(
  'taskNotification',
  taskNotificationSchema,
  'taskNotifications',
);
