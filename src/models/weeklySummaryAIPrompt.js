const mongoose = require('mongoose');

const { Schema } = mongoose;

const WeeklySummaryAIPrompt = new Schema({
    _id: { type: mongoose.Schema.Types.String },
    aIPromptText: { type: String },
});

module.exports = mongoose.model('weeklySummaryAIPrompt', WeeklySummaryAIPrompt, 'weeklySummaryAIPrompt');
