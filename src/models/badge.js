const mongoose = require('mongoose');

const { Schema } = mongoose;

const Badge = new Schema({
  badgeName: { type: String, required: true },
  type: { type: String, enum: ['No Infringement Streak', 'Minimum Hours Multiple', 'Personal Max', 'Most Hrs in Week', 'X Hours for X Week Streak', 'Lead a team of X+', 'Total Hrs in Category', 'Custom'], default: 'Total Hrs in Category' },
  multiple: { type: Number },
  weeks: { type: Number },
  months: { type: Number },
  totalHrs: { type: Number },
  people: { type: Number },
  category: {
    type: String,
    enum: ['Food', 'Energy', 'Housing', 'Education', 'Society', 'Economics', 'Stewardship', 'Unassigned', 'Other', 'Unspecified'],
    default: 'Unassigned',
  }, // "Other" kept for legacy reasons
  project: { type: Schema.Types.ObjectId, ref: 'project' },
  imageUrl: { type: String },
  ranking: { type: Number },
  description: { type: String },
  showReport: { type: Boolean },
});

module.exports = mongoose.model('badge', Badge, 'badges');
