const mongoose = require('mongoose');

const { Schema } = mongoose;

const injuryIssue = new Schema({
    projectId: { type: mongoose.SchemaTypes.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    openDate: { type: Date, default: Date.now },
    category: { type: String, required: true },
    assignedTo: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    totalCost: { type: Number }
});


module.exports = mongoose.model('injuryIssue', injuryIssue, 'injuryIssue');
