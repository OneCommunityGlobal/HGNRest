const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
    required: true
  },
  projectName: {
    type: String,
    required: true,
  },
  equipmentIssues: {
    type: Number,
    required: true,
  },
  laborIssues: {
    type: Number,
    required: true,
  },
  materialIssues: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Create a compound index on projectId and issueType for efficient querying
issueSchema.index({ projectId: 1 });

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;
