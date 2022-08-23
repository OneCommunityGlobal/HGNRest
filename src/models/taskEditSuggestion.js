/* eslint-disable linebreak-style */
const mongoose = require('mongoose');

const { Schema } = mongoose;

const TaskEditSuggestion = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  user: { type: String, required: true },
  dateSuggested: { type: Date, default: Date.now() },
  taskId: { type: Schema.Types.ObjectId, ref: 'task', required: true },
  wbsId: { type: mongoose.SchemaTypes.ObjectId, ref: 'wbs', required: true },
  projectId: { type: mongoose.SchemaTypes.ObjectId, ref: 'projects', required: true },
  projectMembers: [{
    _id: { type: Schema.Types.ObjectId, ref: 'userProfile', required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
  }],
  oldTask: {
    _id: { type: mongoose.SchemaTypes.ObjectId, ref: 'tasks', required: true },
    taskName: { type: String, required: true },
    priority: { type: String, default: 'Primary' },
    resources: [
      {
        name: { type: String, required: true },
        userID: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfiles' },
        profilePic: { type: String },
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
  newTask: {
    taskName: { type: String, required: true },
    priority: { type: String, default: 'Primary' },
    resources: [
      {
        name: { type: String, required: true },
        userID: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfiles' },
        profilePic: { type: String },
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

module.exports = mongoose.model('taskEditSuggestion', TaskEditSuggestion, 'taskEditSuggestions');
