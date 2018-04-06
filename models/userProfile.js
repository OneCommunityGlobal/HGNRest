var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validate = require('mongoose-validator');
var bcrypt = require('bcryptjs');

const SALT_Rounds = 10;

var userProfileSchema = new Schema({

  password: {
    type: String, required: true, validate: {
      validator: function (v) {
        let passwordregex = /(?=^.{8,}$)((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
        return passwordregex.test(v);
      },
      message: '{VALUE} is not a valid password!password should be at least 8 charcaters long with uppercase, lowercase and number/special char.'
    },
  },
  isActive: { type: Boolean, required: true, default: true },
  role: { type: String, required: true, enum: ['Volunteer', 'Manager', 'Administrator', 'Core Team'] },
  firstName: { type: String, required: true, trim: true, minlength: 2 },
  lastName: { type: String, required: true, minlength: 2 },
  phoneNumber: [{ type: String, phoneNumber: String }],
  bio: { type: String },
  email: { type: String, required: true, unique: true, validate: [validate({ validator: 'isEmail', message: 'Email address is invalid' })] },
  weeklyComittedHours: { type: Number, default: 10 },
  createdDate: { type: Date, required: true },
  lastModifiedDate: { type: Date, required: true, default: Date.now() },
  personalLinks: [{ _id: Schema.Types.ObjectId, Name: String, Link: { type: String } }],
  adminLinks: [{ _id: Schema.Types.ObjectId, Name: String, Link: String }],
  teamId: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'team' }],
  badgeCollection: [{ badgeName: String, quantity: Number, lastModifiedDate: Date }],
  profilePic: { type: String }

});

userProfileSchema.pre('save', function (next) {

  var user = this;
  if (!user.isModified('password')) return next();

  bcrypt.genSalt(SALT_Rounds)
    .then(function (result) {
      return bcrypt.hash(user.password, result);
    })
    .then(function (hash) {
      user.password = hash;
      next();
    })
    .catch(function (error) {
      next(error);
    });

});


module.exports = mongoose.model('userProfile', userProfileSchema, 'userProfiles');
