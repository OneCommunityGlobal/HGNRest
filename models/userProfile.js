var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validate = require('mongoose-validate');
require('mongoose-type-url');

var userProfileSchema = new Schema({
  userName: {type: String, required: true},
  password: {type: String, required: true},
  isActive : {type: Boolean, required: true, default : true},
  role : {type: String, required: true, enum : ['Volunteer', 'Manager', 'Administrator', 'Core Team']},
  firstName: {type: String, required: true, trim: true, minlength: 2},
  lastName: {type: String, required: true, minlength: 2},
  phoneNumber : [{type: String, phoneNumber : String}],
  bio: {type: String},
  email: { type: String, required: true, validate: [validate.email, 'Please enter a valid email address'] },
  weeklyComittedHours : {type: Number, default: 10},
  createdDate: {type: Date, required: true},
  lastModifiedDate: {type: Date, required: true, default : Date.now()},
  professionalLinks : [{Name :String, Link : String}],
  socialLinks : [{Name :String, Link : String}],
  otherLinks : [{Name :String, Link: String}],
  teamId : [{type: mongoose.SchemaTypes.ObjectId, ref: 'team'}],
  badgeCollection: [{badgeName: String, quantity: Number, lastModifiedDate: Date}]
  
});

module.exports = mongoose.model('userProfile', userProfileSchema, 'userProfiles');
