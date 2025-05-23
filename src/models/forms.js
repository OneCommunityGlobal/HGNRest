const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Define the schema for a form
const FormSchema = new mongoose.Schema({
  formID: {
    type: String,
    default: uuidv4,  // Automatically generates a unique ID for each form
    unique: true,
  },
  formName: {
    type: String,
    required: true,
    unique:true,
  },
  questions: [
    {
      label: { type: String, required: true },  // Question label
      type: { type: String, required: true },   // e.g., 'text', 'radio', 'checkbox'
      options: [String],  // For questions with options (e.g., radio buttons, checkboxes)
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    // user id of the user who created it.
    type:String,
    required:true
  }
});

module.exports = mongoose.model('Form', FormSchema);