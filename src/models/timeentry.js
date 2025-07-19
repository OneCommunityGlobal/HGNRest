const mongoose = require('mongoose');

const { Schema } = mongoose;

const TimeEntry = new Schema({
  entryType: { type: String, required: true, default: 'default' },
  personId: { type: Schema.Types.ObjectId, ref: 'userProfile' },
  projectId: { type: Schema.Types.ObjectId, ref: 'project' },
  wbsId: { type: Schema.Types.ObjectId, default: null, ref: 'wbs' },
  taskId: { type: Schema.Types.ObjectId, default: null, ref: 'task' },
  teamId: { type: Schema.Types.ObjectId, ref: 'team' },
  dateOfWork: { type: String, required: true },
  totalSeconds: { type: Number },
  notes: { type: String },
  isTangible: { type: Boolean, default: false },
  createdDateTime: { type: Date },
  lastModifiedDateTime: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});
TimeEntry.index({ personId: 1, dateOfWork: 1 });
TimeEntry.index({ entryType: 1, teamId: 1, dateOfWork: 1, isActive: 1 });
TimeEntry.index({ personId: 1, dateOfWork: 1 });


module.exports = mongoose.model('timeEntry', TimeEntry, 'timeEntries');
