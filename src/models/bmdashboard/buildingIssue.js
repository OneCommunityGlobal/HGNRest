const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingIssue = new Schema({
  createdDate: { type: Date, required: true, default: Date.now() },
  issueDate: { type: Date, required: true },
  closedDate: { type: Date, default: null },
  createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
  staffInvolved: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' }],
  issueTitle: [{ type: String, required: true, maxLength: 50 }],
  issueText: [{ type: String, required: true, maxLength: 500 }],
  imageUrl: [{ type: String }],
  projectId: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject', required: true },
  cost: { type: Number, required: true },
  tag: { type: String, enum: ['In-person', 'Virtual'], required: true },
  status: { type: String, enum: ['open', 'closed'], required: true, default: 'open' },
  person: { name: { type: String }, role: { type: String } },
});

module.exports = mongoose.model('buildingIssue', buildingIssue, 'buildingIssues');