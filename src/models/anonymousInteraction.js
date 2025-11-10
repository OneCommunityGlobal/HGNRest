const mongoose = require('mongoose');

const { Schema } = mongoose;

const anonymousInteractionSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  interactionType: {
    type: String,
    required: true,
    enum: [
      'page_view',
      'job_view', 
      'job_search',
      'ad_click',
      'download',
      'video_play',
      'social_share',
      'email_signup',
      'contact_form',
      'filter_use'
    ],
  },
  targetId: {
    type: String,
    required: true,
  },
  targetTitle: {
    type: String,
    required: true,
  },
  timestamp: {
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
  sessionDuration: {
    type: Number,
    default: 0,
  },
  referrer: {
    type: String,
    default: '',
  },
  metadata: {
    searchQuery: String,
    filterCategories: [String],
    downloadType: String,
    videoProgress: Number,
  },
});

anonymousInteractionSchema.index({ timestamp: 1 });
anonymousInteractionSchema.index({ interactionType: 1, timestamp: 1 });
anonymousInteractionSchema.index({ targetId: 1, timestamp: 1 });
anonymousInteractionSchema.index({ sessionId: 1, timestamp: 1 });

anonymousInteractionSchema.index({ 
  timestamp: 1 
}, { 
  expireAfterSeconds: 2592000 
});

module.exports = mongoose.model('AnonymousInteraction', anonymousInteractionSchema, 'anonymousInteractions');