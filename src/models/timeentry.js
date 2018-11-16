const mongoose = require('mongoose');

const { Schema } = mongoose;


const TimeEntry = new Schema({
  personId: { type: Schema.Types.ObjectId, required: [true, 'Resource is a required field'], ref: 'userProfile' },
  projectId: { type: Schema.Types.ObjectId, required: [true, 'Project is a required field'], ref: 'project' },
  dateOfWork: { type: String, required: true },
  totalSeconds: { type: Number },
  notes: { type: String },
  isTangible: { type: Boolean, default: false },
  createdDateTime: { type: Date },
  lastModifiedDateTime: { type: Date, default: Date.now },

});

module.exports = mongoose.model('timeEntry', TimeEntry, 'timeEntries');
