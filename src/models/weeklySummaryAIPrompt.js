const mongoose = require('mongoose');

const { Schema } = mongoose;

const WeeklySummaryAIPrompt = new Schema({
  _id: { type: mongoose.Schema.Types.String },
  aIPromptText: { type: String },
  modifiedDatetime: { type: Date, default: Date.now() }, // The modifiedDateTime will be updated, each time there is change/ update in the AI prompt.
});

module.exports = mongoose.model(
  'weeklySummaryAIPrompt',
  WeeklySummaryAIPrompt,
  'weeklySummaryAIPrompt',
);
