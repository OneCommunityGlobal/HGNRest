const mongoose = require('mongoose');

const { Schema } = mongoose;

// Store ISO_A3 country codes (USA, IND, DEU) for map geos
const applicationSchema = new Schema(
  {
    country: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      index: true,
    },
    role: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    numberOfApplicants: { type: Number, required: true, default: 1, min: 0 },
    // Additional fields for enhanced analytics
    jobId: { type: String, index: true },
    jobTitle: { type: String },
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
    // Store country name for better display
    countryName: { type: String },
    // Store region for grouping
    region: { type: String },
  },
  { timestamps: true },
);

// Enhanced indexes for better query performance
applicationSchema.index({ timestamp: 1, country: 1 });
applicationSchema.index({ role: 1, timestamp: 1 });
applicationSchema.index({ country: 1, role: 1, timestamp: 1 });
applicationSchema.index({ timestamp: 1, applicationSource: 1 });
applicationSchema.index({ jobId: 1, timestamp: 1 });

module.exports = mongoose.model('Application', applicationSchema);
