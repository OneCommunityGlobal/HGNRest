const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingIssue = new Schema({
    createdDate: { type: Date, required: true, default: Date.now() },
    issueDate: { type: String, required: true },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    staffInvolved: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' }],
    issueTitle: [{ type: String, required: true, maxLength: 50 }],
    issueText: [{ type: String, required: true, maxLength: 500 }],
    referredLesson: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingNewLesson', required: true },
    imageUrl: [{ type: String }],
});

module.exports = mongoose.model('buildingIssue', buildingIssue, 'buildingIssues');
