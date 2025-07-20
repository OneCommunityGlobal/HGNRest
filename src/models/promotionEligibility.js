// src/models/promotionEligibility.js
const mongoose = require('mongoose');

const { Schema } = mongoose; // This line was likely causing an error before

const promotionEligibilitySchema = new Schema({
  reviewerId: { type: Schema.Types.ObjectId, ref: 'userProfiles', required: true },
  reviewerName: { type: String, required: true },
  pledgedHours: { type: Number, required: true },
  requiredPRs: { type: Number, required: true },
  totalReviews: { type: Number, required: true },
  remainingWeeks: { type: Number, required: true },
  isNewMember: { type: Boolean, required: true },
  weeklyRequirementsMet: { type: Boolean, required: true },
  calculatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('promotionEligibility', promotionEligibilitySchema);
