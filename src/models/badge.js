const mongoose = require('mongoose');

const { Schema } = mongoose;

// add categoryId after Category colletion is created
const Badge = new Schema({
  badgeName: { type: String, required: true },
  category: { type: String, required: true, enum: ['Education', 'Infrastructure', 'Marketing & Promotion', 'Interviews & Hospitality', 'Funding & Partnership Building', 'Other'] },
  projectId: { type: Schema.Types.ObjectId, required: [true, 'Project is a required field'], ref: 'project' },
  imageUrl: { type: String },
  ranking: { type: Number },
  description: { type: String },
});

module.exports = mongoose.model('badge', Badge, 'badges');
