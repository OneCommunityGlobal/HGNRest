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

module.exports = mongoose.model('OwnerMessageLog', ownerMessageLog);
