const mongoose = require('mongoose');

const { Schema } = mongoose;
const User = require('./userProfile');

const ownerMessageLog = new Schema(
  {
    oldMessage: { type: String },
    newMessage: { type: String },
    action: { type: String, required: true },
    requestorId: {
      type: mongoose.Types.ObjectId,
      ref: User,
    },
    requestorEmail: { type: String },
    requestorName: { type: String },
  },
  { timestamps: true },
);

ownerMessageLog.index({ createdAt: -1 });

module.exports = mongoose.model('OwnerMessageLog', ownerMessageLog);
