const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingIssue = new Schema({
  createdDate: { type: Date, required: true, default: Date.now() },
  issueDate: { type: Date, required: true },
  createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
  staffInvolved: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' }],
  issueTitle: [{ type: String, required: true, maxLength: 50 }],
  issueText: [{ type: String, required: true, maxLength: 500 }],
  issueType: { type: String, required: true },
  imageUrl: [{ type: String }],
  projectId: { type: Schema.Types.ObjectId, ref: 'buildingProject', required: true },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },
  // not sure if we still need related lesson here:
  // relatedLesson: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingNewLesson', required: true },
});

// Indexes for efficient querying and filtering
// Single field index on projectId for project filtering
buildingIssue.index({ projectId: 1 });

// Single field index on issueType for issue type filtering
buildingIssue.index({ issueType: 1 });

// Single field index on issueDate for date range filtering
buildingIssue.index({ issueDate: 1 });

// Compound index on (projectId, issueType, issueDate) for optimal query performance
// This index supports queries that filter by multiple criteria simultaneously
buildingIssue.index({ projectId: 1, issueType: 1, issueDate: 1 });

module.exports = mongoose.model('buildingIssue', buildingIssue, 'buildingIssues');
