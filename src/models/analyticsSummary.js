const mongoose = require('mongoose');

const { Schema } = mongoose;

const analyticsSummarySchema = new Schema({
  date: {
    type: Date,
    required: true,
    index: true,
  },
  summaryType: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly'],
    index: true,
  },
  metrics: {
    totalInteractions: {
      type: Number,
      default: 0,
    },
    uniqueSessions: {
      type: Number,
      default: 0,
    },
    applicationSubmissions: {
      type: Number,
      default: 0,
    },
    conversionRate: {
      type: Number,
      default: 0,
    },
    averageSessionDuration: {
      type: Number,
      default: 0,
    },
    topCountries: [
      {
        country: String,
        count: Number,
        percentage: Number,
      },
    ],
    topStates: [
      {
        state: String,
        count: Number,
        percentage: Number,
      },
    ],
    deviceBreakdown: {
      mobile: {
        type: Number,
        default: 0,
      },
      desktop: {
        type: Number,
        default: 0,
      },
      tablet: {
        type: Number,
        default: 0,
      },
    },
    originBreakdown: {
      direct: {
        type: Number,
        default: 0,
      },
      search: {
        type: Number,
        default: 0,
      },
      social: {
        type: Number,
        default: 0,
      },
      referral: {
        type: Number,
        default: 0,
      },
      email: {
        type: Number,
        default: 0,
      },
      other: {
        type: Number,
        default: 0,
      },
    },
    interactionBreakdown: {
      page_view: { type: Number, default: 0 },
      job_view: { type: Number, default: 0 },
      job_search: { type: Number, default: 0 },
      ad_click: { type: Number, default: 0 },
      download: { type: Number, default: 0 },
      video_play: { type: Number, default: 0 },
      social_share: { type: Number, default: 0 },
      email_signup: { type: Number, default: 0 },
      contact_form: { type: Number, default: 0 },
      filter_use: { type: Number, default: 0 },
    },
    topJobViews: [
      {
        jobId: String,
        jobTitle: String,
        views: Number,
        applications: Number,
        conversionRate: Number,
      },
    ],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

analyticsSummarySchema.index({ date: 1, summaryType: 1 }, { unique: true });
analyticsSummarySchema.index({ summaryType: 1, date: -1 });

analyticsSummarySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AnalyticsSummary', analyticsSummarySchema, 'analyticsSummaries');
