const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  dateTime: { type: Date, required: true },
  duration: { type: Number, required: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile', required: true },
  participantList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'userProfile', required: true }],
  location: { type: String },
  notes: { type: String },
  isRead: { type: Boolean, default: false },
});

module.exports = mongoose.model('Meeting', meetingSchema);
