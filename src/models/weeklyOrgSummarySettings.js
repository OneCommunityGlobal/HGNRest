const mongoose = require('mongoose');

const { Schema } = mongoose;

// Single document (key 'default') holding the weekly Total Org Summary email schedule.
const weeklyOrgSummarySettings = new Schema({
  key: { type: String, default: 'default', unique: true },
  // Off until an admin turns it on, so a deploy never emails anyone by surprise.
  enabled: { type: Boolean, default: false },
  dayOfWeek: { type: Number, min: 0, max: 6, default: 0 }, // 0 = Sunday
  hour: { type: Number, min: 0, max: 23, default: 8 },
  minute: { type: Number, min: 0, max: 59, default: 0 },
  timezone: { type: String, default: 'America/Los_Angeles' },
  alertRecipients: { type: [String], default: [] }, // extra failure-alert addresses
  updatedBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('weeklyOrgSummarySettings', weeklyOrgSummarySettings);
