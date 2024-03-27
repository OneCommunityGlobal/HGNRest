const mongoose = require('mongoose');

const profileInitialSetupTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  weeklyCommittedHours: {
      type: Number,
      required: true,
      default: 10,
  },
  expiration: {
    type: Date,
    required: true,
  },
  // New fields added to the schema
  createdDate: {
    type: Date,
    required: true,
    default: Date.now(),
  },
  isCancelled: {
    type: Boolean,
    required: true,
    default: false,
  },
  isSetupCompleted: {
    type: Boolean,
    required: true,
    default: false,
  },
});

module.exports = mongoose.model('profileInitialSetupToken', profileInitialSetupTokenSchema, 'profileInitialSetupToken');
// Table indexes
profileInitialSetupTokenSchema.index({ createdDate: -1 }, { token: 1 });
profileInitialSetupTokenSchema.index({ isSetupCompleted: -1, createdDate: -1 });
