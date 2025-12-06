const mongoose = require('mongoose');

const { Schema } = mongoose;

const EmailHistorySchema = new Schema({
  uniqueKey: {
    type: String,
    required: true,
    index: true,
    unique: true, // enforce uniqueness at DB level
  },
  to: [String],
  cc: [String],
  bcc: [String],
  subject: String,
  message: String,
  status: { type: String, enum: ['SENT', 'FAILED', 'QUEUED'], default: 'QUEUED' },
  attempts: { type: Number, default: 0 },
  error: String,
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('emailHistory', EmailHistorySchema, 'emailHistory');
