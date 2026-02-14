const mongoose = require('mongoose');
const uuid = require('uuid');

const AttendanceStatuses = ['pending', 'checked_in', 'no_show', 'cancelled'];

const AttendanceLogSchema = new mongoose.Schema(
  {
    attendanceCode: {
      type: String,
      unique: true,
      default: () => uuid.v4(),
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
    },
    participantExternalId: {
      type: String,
    },
    participantName: {
      type: String,
      required: true,
    },
    participantEmail: {
      type: String,
    },
    checkInTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: AttendanceStatuses,
      default: 'pending',
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true },
);

AttendanceLogSchema.index({ eventId: 1, participantId: 1 }, { unique: true, sparse: true });

AttendanceLogSchema.index({ eventId: 1, participantExternalId: 1 }, { unique: true, sparse: true });

const AttendanceLog = mongoose.model('AttendanceLog', AttendanceLogSchema);
AttendanceLog.AttendanceStatuses = AttendanceStatuses;

module.exports = AttendanceLog;
