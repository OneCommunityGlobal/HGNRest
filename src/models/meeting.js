const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  dateTime: { type: Date, required: true },
  duration: { type: Number, required: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile', required: true },
  participantList: [
    {
      participant: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile', required: true },
      notificationIsRead: { type: Boolean, default: false },
    },
  ],
  location: { type: String },
  notes: { type: String },
});

module.exports = mongoose.model('Meeting', meetingSchema);
