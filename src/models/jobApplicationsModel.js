const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema(
  {
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CollaborationForm',
      required: true,
    }, // Reference to the associated form
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        }, // Reference to the associated question
        answer: mongoose.Schema.Types.Mixed, // Store the user's answer (String, Array, etc.)
      },
    ],
    respondent: {
      type: String,
      default: 'Anonymous',
    }, // Optional: Name or ID of the respondent
    email: {
      type: String,
      default: '',
    }, // Applicant email — used for duplicate detection
    resumeUrl: {
      type: String,
      default: '',
    }, // Azure Blob URL for optional resume upload
    submittedAt: {
      type: Date,
      default: Date.now,
    }, // Timestamp for submission
    // Track cleanup progress so multiple workers cannot claim the same application.
    cleanup: {
      status: {
        type: String,
        enum: ['pending', 'processing'],
        default: 'pending',
      },
      claimToken: {
        type: String,
        default: null,
      },
      leaseExpiresAt: {
        type: Date,
        default: null,
      },
      lastError: {
        type: String,
        default: null,
      },
    },
  },
  { timestamps: true },
);

const Response = mongoose.model('JobApplications', responseSchema);
module.exports = Response;
