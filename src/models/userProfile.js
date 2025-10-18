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
  defaultPassword: {
    type: String,
    required: false, // Not required since it's optional
    validate: {
      validator(v) {
        if (!v) return true; // Allow empty values
        const passwordregex = /(?=^.{8,}$)((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
        return passwordregex.test(v);
      },
      message:
        '{VALUE} is not a valid password! Password should be at least 8 characters long with uppercase, lowercase, and number/special character.',
    },
  },
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
    isAcknowledged: { type: Boolean, default: true },
    frontPermissions: [String],
    backPermissions: [String],
    removedDefaultPermissions: [String],
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
  isStartDateManuallyModified: { type: Boolean, default: false },
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
  suggestedProfilePics: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  infringements: [
    {
      date: { type: String, required: true },
      description: { type: String, required: true },
      createdDate: { type: String },
      ccdUsers: {
        type: [
          {
            firstName: { type: String },
            lastName: { type: String },
            email: { type: String, required: true },
          },
        ],
        default: [],
      },
      reasons: {
        type: [String],
        default: ['other'],
        enum: ['time not met', 'missing summary', 'missed video call', 'late reporting', 'other'],
      },
    },
  ],
  warnings: [
    {
      date: { type: String, required: true },
      description: {
        type: String,
        required: true,
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
  trophyFollowedUp: { type: Boolean, default: false },
  isFirstTimelog: { type: Boolean, default: true },
  badgeCount: { type: Number, default: 0 },
  teamCodeWarning: { type: Boolean, default: false },
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
  applicationAccess: { type: mongoose.Schema.Types.ObjectId, ref: 'applicationAccess' },
  questionaireFeedback: {
    haveYouRecievedHelpLastWeek: { type: String, enum: ['Yes', 'No'] },
    peopleYouContacted: [
      {
        fullName: { type: String, required: true },
        rating: { type: Number, min: 1, max: 5 },
        isActive: { type: Boolean, default: false },
      },
    ],
    additionalComments: { type: String },
    daterequestedFeedback: { type: Date, default: Date.now },
    foundHelpSomeWhereClosePermanently: { type: Boolean, default: false },
  },
  infringementCCList: [
    {
      email: { type: String, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String },
      role: { type: String },
      assignedTo: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    },
  ],
  // Education-specific profiles
  educationProfiles: {
    student: {
      cohortId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cohort',
      },
      enrollmentDate: {
        type: Date,
      },
      learningLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner',
      },
      strengths: [
        {
          type: String,
          trim: true,
        },
      ],
      challengingAreas: [
        {
          type: String,
          trim: true,
        },
      ],
    },
    teacher: {
      subjects: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject',
        },
      ],
      officeHours: {
        type: String,
        trim: true,
      },
      assignedStudents: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },
    programManager: {
      managedPrograms: [
        {
          type: String,
          trim: true,
        },
      ],
      region: {
        type: String,
        trim: true,
      },
    },
    learningSupport: {
      level: {
        type: String,
        enum: ['junior', 'senior', 'lead'],
        default: 'junior',
      },
      assignedTeachers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },
  },
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
userProfileSchema.index({ projects: 1, firstName: 1 });
userProfileSchema.index({ projects: 1, lastName: 1 });
userProfileSchema.index({ isActive: 1 });
// Add index for weeklySummaries.dueDate to speed up filtering
userProfileSchema.index({ 'weeklySummaries.dueDate': 1 });
// Add compound index for isActive and createdDate
userProfileSchema.index({ isActive: 1, createdDate: 1 });
// Index for weekly summaries date filtering
userProfileSchema.index({ 'weeklySummaries.dueDate': 1 });
// Compound index for isActive and createdDate (for filtering and sorting)
userProfileSchema.index({ isActive: 1, createdDate: 1 });
// Index for total hours calculation and filtering
userProfileSchema.index({ totalTangibleHrs: 1 });
// Index to help with bio status filtering
userProfileSchema.index({ bioPosted: 1 });

module.exports = mongoose.model('userProfile', userProfileSchema, 'userProfiles');
