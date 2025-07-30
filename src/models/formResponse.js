const mongoose = require('mongoose');

// Define the schema for form responses
const FormResponseSchema = new mongoose.Schema({
  formID: {
    type: String,
    required: true,  // Links the response to a specific form by formID
  },
  responses: [
    {
      questionLabel: { type: String, required: true },   // The label of the question (e.g., "What is your name?")
      answer: { type: mongoose.Schema.Types.Mixed, required: true },  // The answer can be of any type (string, number, array)
    },
  ],
  submittedAt: {
    type: Date,
    default: Date.now,    // Date and time when the form was submitted
  },
  submittedBy: {
    type: String,         // ID of the user who submitted the form (optional, depends on your app’s logic)
    required:true
  },
});

module.exports = mongoose.model('FormResponse', FormResponseSchema);
