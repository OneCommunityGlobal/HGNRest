const mongoose = require('mongoose');

const userInfoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  github: { type: String },
  slack: { type: String },
});

const generalSchema = new mongoose.Schema({
  hours: { type: String },
  period: { type: String },
  standup: { type: String },
  location: { type: String },
  manager: { type: String },
  combined_frontend_backend: { type: String },
  combined_skills: { type: String },
  mern_skills: { type: String },
  leadership_skills: { type: String },
  leadership_experience: { type: String },
  preferences: [{ type: String }],
  availability: {
    Monday: { type: String },
    Tuesday: { type: String },
    Wednesday: { type: String },
    Thursday: { type: String },
    Friday: { type: String },
    Saturday: { type: String },
    Sunday: { type: String },
  },
});

const frontendSchema = new mongoose.Schema({
  overall: { type: String },
  HTML: { type: String },
  Bootstrap: { type: String },
  CSS: { type: String },
  React: { type: String },
  Redux: { type: String },
  WebSocketCom: { type: String },
  ResponsiveUI: { type: String },
  UnitTest: { type: String },
  Documentation: { type: String },
  UIUXTools: { type: String },
});

const backendSchema = new mongoose.Schema({
  overall: { type: String },
  Database: { type: String },
  MongoDB: { type: String },
  MongoDB_Advanced: { type: String },
  TestDrivenDev: { type: String },
  Deployment: { type: String },
  VersionControl: { type: String },
  CodeReview: { type: String },
  EnvironmentSetup: { type: String },
  AdvancedCoding: { type: String },
  AgileDevelopment: { type: String },
});

const followupSchema = new mongoose.Schema({
  platform: { type: String },
  other_skills: { type: String },
  suggestion: { type: String },
  additional_info: { type: String },
});

const hgnFormResponseSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  userInfo: { type: Object, value: userInfoSchema },
  general: { type: Object, value: generalSchema },
  frontend: { type: Object, value: frontendSchema },
  backend: { type: Object, value: backendSchema },
  followUp: { type: Object, value: followupSchema },
});

const formresponses = mongoose.model('HGNFormResponses', hgnFormResponseSchema);

module.exports = formresponses;
