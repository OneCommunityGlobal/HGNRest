const mongoose = require('mongoose');
const moment = require('moment-timezone');

const { Schema } = mongoose;
const validate = require('mongoose-validator');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;
// Update createdDate to be the current date from the next day
// const nextDay = new Date();
// nextDay.setDate(nextDay.getDate() + 1);
const today = new Date();

const userProfileSchema = new Schema({
  // Updated filed
  summarySubmissionDates: [{ type: Date }],
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
  isRehireable: { type: Boolean, default: true },
  isSet: { type: Boolean, required: true, default: false },
  finalEmailThreeWeeksSent: { type: Boolean, required: true, default: false },
  role: {
    type: String,
    required: true,
  },
  permissions: {
    frontPermissions: [String],
    backPermissions: [String],
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    index: true,
  },
  lastName: {
    type: String,
    required: true,
    minlength: 2,
    index: true,
  },
  phoneNumber: [{ type: String, phoneNumber: String }],
  jobTitle: [{ type: String, jobTitle: String }],
  bio: { type: String },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: [validate({ validator: 'isEmail', message: 'Email address is invalid' })],
  },
  copiedAiPrompt: { type: Date, default: Date.now() },
  emailSubscriptions: {
    type: Boolean,
    default: false,
  },
  weeklycommittedHours: { type: Number, default: 10 },
  weeklycommittedHoursHistory: [
    {
      hours: { type: Number, required: true },
      dateChanged: { type: Date, required: true },
    },
  ],
  missedHours: { type: Number, default: 0 },
  createdDate: { type: Date, required: true, default: today },
  // eslint-disable-next-line object-shorthand
  startDate: {
    type: Date,
    required: true,
    default() {
      return this.createdDate;
    },
  },
  lastModifiedDate: { type: Date, required: true, default: Date.now() },
  reactivationDate: { type: Date },
  personalLinks: [{ _id: Schema.Types.ObjectId, Name: String, Link: { type: String } }],
  adminLinks: [{ _id: Schema.Types.ObjectId, Name: String, Link: String }],
  teams: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'team' }],
  projects: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'project' }],
  badgeCollection: [
    {
      badge: { type: mongoose.SchemaTypes.ObjectId, ref: 'badge' },
      count: { type: Number, default: 0 },
      earnedDate: { type: Array, default: [] },
      lastModified: { type: Date, required: true, default: new Date() },
      hasBadgeDeletionImpact: { type: Boolean, default: false },
      featured: {
        type: Boolean,
        required: true,
        default: false,
      },
    },
  ],
  profilePic: { type: String },
  suggestedProfilePics:{
    type:[mongoose.Schema.Types.Mixed],
    default:[]
  },
  infringements: [
    {
      date: { type: String, required: true },
      description: { type: String, required: true },
      createdDate: { type: String },
    },
  ],
  warnings: [
    {
      date: { type: String, required: true },
      description: {
        type: String,
        required: true
      },
      color: {
        type: String,
        enum: ['red', 'blue', 'white', 'yellow'],
        required: true,
        default: 'white',
      },
      iconId: { type: String, required: false },
    },
  ],
  location: {
    userProvided: { type: String, default: '' },
    coords: {
      lat: { type: Number, default: '' },
      lng: { type: Number, default: '' },
    },
    country: { type: String, default: '' },
    city: { type: String, default: '' },
  },
  homeCountry: {
    userProvided: { type: String, default: '' },
    coords: {
      lat: { type: Number, default: '' },
      lng: { type: Number, default: '' },
    },
    country: { type: String, default: '' },
    city: { type: String, default: '' },
  },
  oldInfringements: [
    {
      date: { type: String, required: true },
      description: { type: String, required: true },
    },
    {
      date: { type: String, required: true },
      description: { type: String, required: true },
    },
  ],
  privacySettings: {
    blueSquares: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    phoneNumber: { type: Boolean, default: true },
  },
  weeklySummaries: [
    {
      dueDate: {
        type: Date,
        required: true,
        default: moment().tz('America/Los_Angeles').endOf('week'),
      },
      summary: { type: String },
      uploadDate: { type: Date },
    },
  ],
  weeklySummariesCount: { type: Number, default: 0 },
  mediaUrl: { type: String },
  endDate: { type: Date, required: false },
  resetPwd: { type: String },
  collaborationPreference: { type: String },
  personalBestMaxHrs: { type: Number, default: 0 },
  totalTangibleHrs: { type: Number, default: 0 },
  totalIntangibleHrs: { type: Number, default: 0 },
  hoursByCategory: {
    housing: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    education: { type: Number, default: 0 },
    society: { type: Number, default: 0 },
    energy: { type: Number, default: 0 },
    economics: { type: Number, default: 0 },
    stewardship: { type: Number, default: 0 },
    unassigned: { type: Number, default: 0 },
  },
  lastWeekTangibleHrs: { type: Number, default: 0 },
  categoryTangibleHrs: [
    {
      category: {
        type: String,
        enum: [
          'Food',
          'Energy',
          'Housing',
          'Education',
          'Society',
          'Economics',
          'Stewardship',
          'Other',
          'Unspecified',
        ],
        default: 'Other',
      },
      hrs: { type: Number, default: 0 },
    },
  ],
  savedTangibleHrs: [Number],
  timeEntryEditHistory: [
    {
      date: {
        type: Date,
        required: true,
        default: moment().tz('America/Los_Angeles').toDate(),
      },
      initialSeconds: { type: Number, required: true },
      newSeconds: { type: Number, required: true },
    },
  ],
  weeklySummaryNotReq: { type: Boolean, default: false },
  timeZone: { type: String, required: true, default: 'America/Los_Angeles' },
  isVisible: { type: Boolean, default: true },
  weeklySummaryOption: { type: String },
  bioPosted: { type: String, default: 'default' },
  filterColor: {
    type: [String],
    enum: ['purple', 'green', 'navy', null],
    default: [],
  },
  isFirstTimelog: { type: Boolean, default: true },
  badgeCount: { type: Number, default: 0 },
  teamCode: {
    type: String,
    default: '',
    validate: {
      validator(v) {
        const teamCoderegex = /^(.{5,7}|^$)$/;
        return teamCoderegex.test(v);
      },
      message:
        'Please enter a code in the format of A-AAAA or AAAAA, with optional numbers, and a total length between 5 and 7 characters.',
    },
  },
  infoCollections: [
    {
      areaName: { type: String },
      areaContent: { type: String },
    },
  ],
  // actualEmail field represents the actual email associated with a real volunteer in the main HGN app. actualEmail is required for Administrator and Owner accounts only in the dev environment.
  actualEmail: { type: String },
  timeOffFrom: { type: Date, default: undefined },
  timeOffTill: { type: Date, default: undefined },
  getWeeklyReport: { type: Boolean },
  permissionGrantedToGetWeeklySummaryReport: { type: Date, default: undefined },
});

userProfileSchema.pre('save', function (next) {
  const user = this;
  if (!user.isModified('password')) return next();

  return bcrypt
    .genSalt(SALT_ROUNDS)
    .then((result) => bcrypt.hash(user.password, result))
    .then((hash) => {
      user.password = hash;
      return next();
    })
    .catch((error) => next(error));
});

userProfileSchema.index({ teamCode: 1 });
userProfileSchema.index({ email: 1 });
userProfileSchema.index({ isActive: 1 });

module.exports = mongoose.model('userProfile', userProfileSchema, 'userProfiles');
