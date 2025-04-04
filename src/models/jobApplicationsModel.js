const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema(
  {
    formId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "CollaborationForm", 
      required: true 
    }, // Reference to the associated form
    answers: [
      {
        questionId: { 
          type: mongoose.Schema.Types.ObjectId, 
          required: true 
        }, // Reference to the associated question
        answer: mongoose.Schema.Types.Mixed, // Store the user's answer (String, Array, etc.)
      },
    ],
    respondent: { 
      type: String, 
      default: "Anonymous" 
    }, // Optional: Name or ID of the respondent
    submittedAt: { 
      type: Date, 
      default: Date.now 
    }, // Timestamp for submission
  },
  { timestamps: true }
);

const Response = mongoose.model("JobApplications", responseSchema);
module.exports = Response;
