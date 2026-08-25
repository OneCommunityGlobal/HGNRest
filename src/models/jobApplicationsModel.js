const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema(
  {
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CollaborationForm',
      required: true,
    },
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        answer: mongoose.Schema.Types.Mixed,
      },
    ],
    respondent: {
      type: String,
      default: 'Anonymous',
    },
    email: {
      type: String,
      default: '',
    },
    resumeUrl: {
      type: String,
      default: '',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const Response = mongoose.model('JobApplications', responseSchema);
module.exports = Response;
