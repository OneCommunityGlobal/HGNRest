const mongoose = require('mongoose');

const { Schema } = mongoose;

const metIssue = new Schema({
    createdDate: { type: Date, required: true, default: Date.now() },
    issueDate: { type: Date, required: true },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    issueType: { type: String, required: true, maxLength: 50, enum: ['Safety', 'Labor', 'Weather', 'Other', 'METs quality / functionality'] },
    issueConsequences: [{ type: String, required: true, maxLength: 100 }],
    issueResolved: { type: Boolean, required: true, default: false },
    issueDescription: { type: String, required: true, maxLength: 500 },
});

module.exports = mongoose.model('metIssue', metIssue, 'metIssues');
