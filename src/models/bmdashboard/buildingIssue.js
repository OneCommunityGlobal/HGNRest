const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingIssue = new Schema({
    date: { type: Date, required: true, default: Date.now() },
    staff: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    issue: [{ type: String, required: true, maxLength: 100 }],
    referredLesson: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingNewLesson', required: true },
});

module.exports = mongoose.model('buildingIssue', buildingIssue, 'buildingIssues');
