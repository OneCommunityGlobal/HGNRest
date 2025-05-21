const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  issueType: {
    type: String,
    enum: ['Equipment', 'Labor', 'Materials'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  dateReported: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Create a compound index on projectId and issueType for efficient querying
issueSchema.index({ projectId: 1, issueType: 1 });

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue; 