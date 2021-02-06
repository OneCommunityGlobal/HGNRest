const mongoose = require('mongoose');

const { Schema } = mongoose;

const Badge = new Schema({
  badgeName: { type: String, required: true },
  category: { type: String, enum: ['Food', 'Energy', 'Housing', 'Education', 'Society', 'Economics', 'Stewardship', 'Other'] },
  project: { type: Schema.Types.ObjectId, ref: 'project' },
  imageUrl: { type: String },
  ranking: { type: Number },
  description: { type: String },
});

module.exports = mongoose.model('badge', Badge, 'badges');
