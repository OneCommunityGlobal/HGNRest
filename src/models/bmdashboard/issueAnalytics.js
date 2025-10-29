const mongoose = require('mongoose');

const issueAnalytics = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    required: false,
  },
  issueType: {
    type: String,
    enum: ['equipment', 'labor', 'material'],
    required: true,
  },
  status: {
    type: String,
    enum: ['Open', 'Closed', 'In Progress', 'Resolved', 'Reopened'],
    required: true,
  },
  dateReported: {
    type: Date,
    required: true,
  },
  dateResolved: {
    type: Date,
  },
});
module.exports = mongoose.model('IssueAnalytics', issueAnalytics);
