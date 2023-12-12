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
});

module.exports = mongoose.model('profileInitialSetupToken', profileInitialSetupTokenSchema, 'profileInitialSetupToken');
