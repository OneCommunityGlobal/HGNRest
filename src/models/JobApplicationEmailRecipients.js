const mongoose = require('mongoose');

const { Schema } = mongoose;

// Store one shared recipient list for all job applications.
const jobApplicationEmailRecipientsSchema = new Schema(
  {
    settingsKey: {
      type: String,
      default: 'jobApplicationNotifications',
      unique: true,
      immutable: true,
    },
    recipients: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  'JobApplicationEmailRecipients',
  jobApplicationEmailRecipientsSchema,
);
