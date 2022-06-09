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
    oldTaskName: { type: String, required: true },
    oldPriority: { type: String, default: 'Primary' },
    oldResources: [
      {
        name: { type: String, required: true },
        userID: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfiles' },
        profilePic: { type: String },
      },
    ],
    oldIsAssigned: { type: Boolean, default: true },
    oldStatus: { type: String, default: 'Not Started' },
    oldHoursBest: { type: Number, default: 0.0 },
    oldHoursWorst: { type: Number, default: 0.0 },
    oldHoursMost: { type: Number, default: 0.0 },
    oldEstimatedHours: { type: Number, default: 0.0 },
    oldLinks: [String],
    oldClassification: { type: String },
    oldWhyInfo: { type: String, default: '' },
    oldIntentInfo: { type: String, default: '' },
    oldEndstateInfo: { type: String, default: '' },
    oldStartedDatetime: { type: Date },
    oldDueDatetime: { type: Date },
  },
});

module.exports = mongoose.model(
  'taskNotification',
  taskNotificationSchema,
  'taskNotifications',
);
