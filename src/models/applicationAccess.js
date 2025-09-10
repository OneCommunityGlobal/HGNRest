const mongoose = require('mongoose');

const appAccess = new mongoose.Schema({
  app: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['invited', 'revoked', 'failed'],
    required: true
  },
  credentials: {
    type: String,
    default: null
  },
  invitedOn: {
    type: Date,
    default: null
  },
  revokedOn: {
    type: Date,
    default: null
  },
  failedReason: {
    type: String,
    default: null
  }
}, { _id: false }); // prevent automatic _id generation for each subdoc

const applicationAccessSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  apps: [appAccess]
}, { timestamps: true });

module.exports = mongoose.model('applicationAccess', applicationAccessSchema);
