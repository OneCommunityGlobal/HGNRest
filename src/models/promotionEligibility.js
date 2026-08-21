// src/models/promotionEligibility.js
const mongoose = require('mongoose');

const { Schema } = mongoose; // This line was likely causing an error before

const promotionEligibilitySchema = new Schema({
  reviewerId: { type: Schema.Types.ObjectId, ref: 'userProfiles', required: true },
  reviewerName: { type: String, required: true },
  pledgedHours: { type: Number, required: true },
  requiredPRs: { type: Number, required: true },
  totalReviews: { type: Number, required: true },

  // Prior weeks in which the reviewer reviewed at least `prsNeeded` PRs. Two
  // are required for promotion, so `remainingWeeks` is 2 minus this, floored
  // at zero. The current, still running week is deliberately not counted here;
  // it drives `weeklyRequirementsMet` instead.
  successfulWeeks: { type: Number, default: 0 },
  remainingWeeks: { type: Number, required: true },
  // Joined a week ago or less, which is the spec's split between the table's
  // "New Members" and "Existing Members" sections.
  isNewMember: { type: Boolean, required: true },

  // Whether the requirement is met for the current week. Not a synonym for
  // being eligible to promote, which is `remainingWeeks === 0`.
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
