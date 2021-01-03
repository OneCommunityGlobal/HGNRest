const mongoose = require('mongoose');

const { Schema } = mongoose;

const Badge = new Schema({
  badgeName: { type: String, required: true },
  category: { type: String, required: true, enum: ['Education', 'Infrastructure', 'Marketing & Promotion', 'Interviews & Hospitality', 'Funding & Partnership Building', 'Other'] },
  project: { type: Schema.Types.ObjectId, required: [true, 'Project is a required field'], ref: 'project' },
  imageUrl: { type: String },
  ranking: { type: Number },
  description: { type: String },
});

module.exports = mongoose.model('badge', Badge, 'badges');
