const mongoose = require('mongoose');

const externalTeamSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  roleSpecify: String,
  team: {
    type: String,
    required: true
  },
  teamSpecify: String,
  email: {
    type: String,
    required: true,
    unique: true
  },
  countryCode: String,
  phone: String
}, {
  timestamps: true
});

module.exports = mongoose.model('ExternalTeam', externalTeamSchema);
