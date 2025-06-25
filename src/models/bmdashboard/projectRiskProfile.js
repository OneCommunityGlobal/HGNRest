const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectRiskProfile = new Schema({
    projectId: { type: mongoose.SchemaTypes.ObjectId, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    initialCostEstimate: { type: Number, required: true },
    currentCostIncurred: { type: Number, required: false },
    issues: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'Issue' }],
});

module.exports = mongoose.model('projectRiskProfile', projectRiskProfile, 'projectRiskProfiles');
