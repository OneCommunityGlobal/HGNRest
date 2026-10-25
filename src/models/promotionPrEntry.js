// src/models/promotionPrEntry.js
const mongoose = require('mongoose');
const { RATING_VALUES, PR_ENTRY_SOURCES } = require('../helpers/prEntryHelper');

const { Schema } = mongoose;

/**
 * One PR a reviewer reviewed in one week, for the "+ Add New" column of the
 * Promotion Eligibility dashboard (doc item #23, spec item 5).
 *
 * A separate collection rather than an array on the promotionEligibility doc,
 * because the spec asks for "unlimited tracking" across weeks and these are
 * written one at a time by hand. Growing an unbounded array inside a document
 * that is rewritten on every dashboard read would be the wrong shape.
 *
 * `year` and `week` match MongoDB's $year and $week, the same pair the History
 * column and the weekly requirement use, so everything on this page agrees
 * about which week a thing belongs to.
 */
const promotionPrEntrySchema = new Schema({
  reviewerId: { type: Schema.Types.ObjectId, ref: 'userProfiles', required: true, index: true },

  year: { type: Number, required: true },
  week: { type: Number, required: true },

  // Normalised on the way in. Carries the repo prefix when one was given
  // ("FE-1234"), otherwise a bare number ("1234").
  prNumber: { type: String, required: true },

  // null until somebody rates it. The spec's five options and nothing else.
  rating: { type: String, enum: [...RATING_VALUES, null], default: null },

  // "weeklySummary" means it was parsed out of the reviewer's summary text
  // rather than typed, which is a guess and should be treated as one.
  source: { type: String, enum: PR_ENTRY_SOURCES, default: 'manual' },

  addedBy: { type: Schema.Types.ObjectId, ref: 'userProfiles', default: null },
  addedAt: { type: Date, default: Date.now },
  ratedBy: { type: Schema.Types.ObjectId, ref: 'userProfiles', default: null },
  ratedAt: { type: Date, default: null },
});

// The same PR cannot be listed twice for one reviewer in one week. This is
// what makes the weekly-summary import safe to re-run: a second import adds
// only PRs that were not already there.
promotionPrEntrySchema.index({ reviewerId: 1, year: 1, week: 1, prNumber: 1 }, { unique: true });

module.exports = mongoose.model('promotionPrEntry', promotionPrEntrySchema);
