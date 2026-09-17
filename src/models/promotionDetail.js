const mongoose = require('mongoose');

const promotionDetailsSchema = new mongoose.Schema({
  reviewerName: { type: String, required: true },
  teamCode: { type: String },
  teamReviewerName: { type: String },
  weeklyPRs: [
    {
      week: { type: String },
      count: { type: Number },
    },
  ],
});

module.exports = mongoose.model('promotionDetails', promotionDetailsSchema);
