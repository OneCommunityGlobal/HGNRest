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
        label: {
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
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
);

// Index for better search performance
emailTemplateSchema.index({ name: 1 });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
