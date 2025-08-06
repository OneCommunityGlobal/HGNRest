const mongoose = require('mongoose');
const { Schema } = mongoose;

const hgnformresponsesSchema = new Schema(
  {
    _id: {
      type: Schema.Types.ObjectId,
      auto: true,
    },
    userInfo: {
      name: String,
      email: String,
      github: String,
      slack: String,
    },
    general: {
      hours: String,
      period: String,
      standup: String,
      location: String,
      manager: String,
      combined_frontend_backend: String,
      mern_skills: String,
      leadership_skills: String,
      leadership_experience: String,
    },
    preferences: [String],
    availability: {
      Monday: String,
      Friday: String,
    },
    frontend: {
      overall: String,
      HTML: String,
      Bootstrap: String,
      CSS: String,
      React: String,
      Redux: String,
      WebSocketCom: String,
      ResponsiveUI: String,
      UnitTest: String,
      Documentation: String,
      UIUXTools: String,
    },
    backend: {
      Overall: String,
      Database: String,
      MongoDB: String,
      MongoDB_Advanced: String,
      TestDrivenDev: String,
      Deployment: String,
      VersionControl: String,
      CodeReview: String,
      EnvironmentSetup: String,
      AdvancedCoding: String,
      AgileDevelopment: String,
    },
    followup: {
      platform: String,
      other_skills: String,
      suggestion: String,
      additional_info: String,
    },
    user_id: String,
    _v: Number,
  },
  {
    timestamps: true,
    versionKey: '_v',
  },
);

module.exports = mongoose.model('hgnformresponses', hgnformresponsesSchema);
