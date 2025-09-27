const mongoose = require('mongoose');

const promotionDetailsSchema = new mongoose.Schema({
  reviewerName: { type: String, required: true },
  pledgedHours: { type: Number, required: true },
  requiredPRs: { type: Number, required: true },
  totalReviews: { type: Number, required: true },
  remainingWeeks: { type: Number, required: true },
  isNewMember: { type: Boolean, required: true },
  weeklyRequirementsMet: { type: Boolean, required: true },
});

module.exports = mongoose.model('promotionDetails', promotionDetailsSchema);
