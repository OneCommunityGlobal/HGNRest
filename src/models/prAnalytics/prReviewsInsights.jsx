const mongoose = require('mongoose');

const { Schema } = mongoose;

const PRReviewInsightsSchema = new Schema({
  teamCode: { type: String, required: true },
  reviewDate: { type: Date, required: true },
  actionTaken: { type: String, enum: ['Approved', 'Changes Requested', 'Commented'], required: true },
  qualityLevel: { type: String, enum: ['Not approved', 'Low Quality', 'Sufficient', 'Exceptional'], required: true },
});

module.exports = mongoose.model('PRReviewInsights', PRReviewInsightsSchema, 'prReviewInsights');