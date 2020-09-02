const mongoose = require('mongoose');
const moment = require('moment-timezone');

const { Schema } = mongoose;
const validate = require('mongoose-validator');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const userProfileSchema = new Schema({
  password: {
    type: String,
    required: true,
    validate: {
      validator(v) {
        const passwordregex = /(?=^.{8,}$)((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
        return passwordregex.test(v);
      },
      message:
        '{VALUE} is not a valid password!password should be at least 8 charcaters long with uppercase, lowercase and number/special char.',
    },
  },
  isActive: { type: Boolean, required: true, default: true },
  role: {
    type: String,
    required: true,
    enum: ['Volunteer', 'Manager', 'Administrator', 'Core Team'],
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
  },
  lastName: { type: String, required: true, minlength: 2 },
  phoneNumber: [{ type: String, phoneNumber: String }],
  jobTitle: [{ type: String, jobTitle: String }],
  bio: { type: String },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: [
      validate({ validator: 'isEmail', message: 'Email address is invalid' }),
    ],
  },
  weeklyComittedHours: { type: Number, default: 10 },
  createdDate: { type: Date, required: true, default: Date.now() },
  lastModifiedDate: { type: Date, required: true, default: Date.now() },
  reactivationDate: { type: Date },
  personalLinks: [
    { _id: Schema.Types.ObjectId, Name: String, Link: { type: String } },
  ],
  adminLinks: [{ _id: Schema.Types.ObjectId, Name: String, Link: String }],
  teams: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'team' }],
  projects: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'project' }],
  badgeCollection: [
    { badgeName: String, quantity: Number, lastModifiedDate: Date },
  ],
  profilePic: { type: String },
  infringments: [{ date: { type: String, required: true }, description: { type: String, required: true } }],
  privacySettings: { blueSquares: { type: Boolean }, email: { type: Boolean }, phoneNumber: { type: Boolean } },
  weeklySummaries: [{ dueDate: { type: Date, required: true, default: moment().tz('America/Los_Angeles').endOf('week') }, summary: { type: String } }],
  weeklySummariesCount: { type: Number, default: 0 },
  mediaUrl: { type: String },
});

userProfileSchema.pre('save', function (next) {
  const user = this;
  if (!user.isModified('password')) return next();

  return bcrypt
    .genSalt(SALT_ROUNDS)
    .then(result => bcrypt.hash(user.password, result))
    .then((hash) => {
      user.password = hash;
      return next();
    })
    .catch(error => next(error));
});

module.exports = mongoose.model(
  'userProfile',
  userProfileSchema,
  'userProfiles',
);
