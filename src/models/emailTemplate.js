const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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
          enum: ['text', 'url', 'number', 'textarea', 'image'],
          default: 'text',
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

// Indexes for better search performance
emailTemplateSchema.index({ name: 1 });
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

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
