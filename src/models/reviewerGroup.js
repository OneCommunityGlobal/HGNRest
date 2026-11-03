// src/models/reviewerGroup.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * A "Review for This Week" group on the Promotion Eligibility dashboard.
 *
 * Membership is NOT stored here. A group owns an alphabetical range and
 * membership is derived from it at read time, so nobody has to maintain a
 * member list as volunteers join and leave. See `helpers/reviewerGroupHelper.js`.
 */
const reviewerGroupSchema = new Schema({
  // Stable identifier the frontend sends back to filter the table. Derived from
  // the label once at creation and never changed, so a rename does not break a
  // dropdown selection the user already made.
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },

  // Inclusive single letters, A to Z. Both null means the group takes everybody,
  // which is only ever the All Members group.
  rangeStart: { type: String, default: null },
  rangeEnd: { type: String, default: null },

  // False locks the group against renaming and range edits. Only All Members.
  editable: { type: Boolean, default: true },

  // Dropdown position.
  sortOrder: { type: Number, default: 0 },

  updatedBy: { type: Schema.Types.ObjectId, ref: 'userProfiles', default: null },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('reviewerGroup', reviewerGroupSchema);
