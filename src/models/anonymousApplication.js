const mongoose = require('mongoose');

const { Schema } = mongoose;

const anonymousApplicationSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  jobId: {
    type: String,
    required: true,
    index: true,
  },
  jobTitle: {
    type: String,
    required: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
  location: {
    country: {
      type: String,
      default: 'Unknown',
    },
    state: {
      type: String,
      default: 'Unknown',
    },
  },
  deviceType: {
    type: String,
    required: true,
    enum: ['mobile', 'desktop', 'tablet'],
  },
  origin: {
    type: String,
    required: true,
    enum: ['direct', 'search', 'social', 'referral', 'email', 'other'],
    default: 'direct',
  },
  applicationSource: {
    type: String,
    enum: [
      'job_listing',
      'search_results',
      'company_page',
      'social_media',
      'email_campaign',
      'referral_link',
      'advertisement',
      'direct_application',
      'other',
    ],
    default: 'job_listing',
  },
  conversionTime: {
    type: Number,
    default: 0,
  },
  interactionsBeforeApplication: {
    type: Number,
    default: 0,
  },
  referrer: {
    type: String,
    default: '',
  },
  metadata: {
    timeToApply: Number,
    pagesVisited: Number,
    searchesPerformed: Number,
    downloadsCompleted: Number,
  },
});

anonymousApplicationSchema.index({ submittedAt: 1 });
anonymousApplicationSchema.index({ jobId: 1, submittedAt: 1 });
anonymousApplicationSchema.index({ sessionId: 1, submittedAt: 1 });
anonymousApplicationSchema.index({ applicationSource: 1, submittedAt: 1 });

anonymousApplicationSchema.index(
  {
    submittedAt: 1,
  },
  {
    expireAfterSeconds: 2592000,
  },
);

module.exports = mongoose.model(
  'AnonymousApplication',
  anonymousApplicationSchema,
  'anonymousApplications',
);
