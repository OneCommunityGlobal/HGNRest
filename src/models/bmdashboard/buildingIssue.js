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
    projectId: { type: Schema.Types.ObjectId, ref: 'buildingProject', required: true },
    imageUrl: [{ type: String }],
    // not sure if we still need related lesson here:
    // relatedLesson: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingNewLesson', required: true },
});

module.exports = mongoose.model('buildingIssue', buildingIssue, 'buildingIssues');
