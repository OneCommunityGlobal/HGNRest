var mongoose = require('mongoose'),
  Schema = mongoose.Schema;



var profileSchema = new Schema({
  name: String,
  phone: String,
  email: String,
  about: String,
  linkedin: String,
  facebook: String,
  comitted_hours: Number,
  avatar: String,
  estimated_tenure: {
    type: Date,
    default: Date.now
  },
  created: {
    type: Date,
    default: Date.now
  },
});

module.exports = mongoose.model('Profile', profileSchema, 'profiles');
