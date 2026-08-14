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

  // PRs Needed, derived from the reviewer's weekly committed hours bands.
  // `requiredPRs` above is kept in step with this so the current frontend,
  // which reads `requiredPRs`, keeps working while the page is rebuilt.
  prsNeeded: { type: Number },
  prsNeededSource: { type: String, enum: ['auto', 'ownerOverride'], default: 'auto' },

  // Set only when an Owner edits PRs Needed by hand. While this holds a value
  // the figure stops tracking committed hours, per the spec. null means "auto".
  prsNeededOverride: { type: Number, default: null },
  prsNeededOverrideBy: { type: Schema.Types.ObjectId, ref: 'userProfiles', default: null },
  prsNeededOverrideAt: { type: Date, default: null },

  // True when committed hours moved since the last calculation, so the page can
  // surface the change. Always false while an Owner override is in place.
  committedHoursChanged: { type: Boolean, default: false },
});

module.exports = mongoose.model('promotionEligibility', promotionEligibilitySchema);
