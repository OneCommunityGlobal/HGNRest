const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  dateOfMeeting: { type: Date, required: true },
  startHour: { type: Number, required: true },
  startMinute: { type: Number, required: true },
  startTimePeriod: { type: String, required: true },
  duration: { type: Number, required: true },
  participantList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'userProfile', required: true }],
  location: { type: String},
  notes: { type: String },
});

module.exports = mongoose.model('Meeting', meetingSchema);