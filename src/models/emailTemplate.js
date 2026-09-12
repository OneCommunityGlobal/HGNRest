/**
 * EmailTemplate model for reusable announcement email content.
 * - Stores template name, subject, HTML content, and declared variables
 * - Tracks creator/updater and timestamps for auditing and sorting
 * - Includes helpful indexes and text search for fast lookup
 */
const mongoose = require('mongoose');
const { EMAIL_CONFIG } = require('../config/emailConfig');

const emailTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    html_content: {
      type: String,
      required: true,
    },
    variables: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        type: {
          type: String,
          enum: EMAIL_CONFIG.TEMPLATE_VARIABLE_TYPES,
        },
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
);

// Unique index on name (case-insensitive)
emailTemplateSchema.index({ name: 1 }, { unique: true });

// Indexes for better search performance
emailTemplateSchema.index({ created_at: -1 });
emailTemplateSchema.index({ updated_at: -1 });
emailTemplateSchema.index({ created_by: 1 });
emailTemplateSchema.index({ updated_by: 1 });

// Text index for full-text search
emailTemplateSchema.index({
  name: 'text',
  subject: 'text',
});

// Compound indexes for common queries
emailTemplateSchema.index({ created_by: 1, created_at: -1 });
emailTemplateSchema.index({ name: 1, created_at: -1 });

// Virtual for camelCase compatibility (for API responses)
emailTemplateSchema.virtual('htmlContent').get(function () {
  return this.html_content;
});

emailTemplateSchema.virtual('createdBy').get(function () {
  return this.created_by;
});

emailTemplateSchema.virtual('updatedBy').get(function () {
  return this.updated_by;
});

emailTemplateSchema.virtual('createdAt').get(function () {
  return this.created_at;
});

emailTemplateSchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});

// Ensure virtuals are included in JSON output
emailTemplateSchema.set('toJSON', { virtuals: true });
emailTemplateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
