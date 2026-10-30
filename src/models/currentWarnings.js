const mongoose = require('mongoose');

const { Schema } = mongoose;

const currentWarnings = new Schema({
  warningTitle: { type: String, required: true, index: true },
  normalizedWarningTitle: { type: String, required: true, unique: true, sparse: true },
  activeWarning: { type: Boolean, required: true },
  isPermanent: { type: Boolean, required: true },
  isSpecial: { type: Boolean },
  abbreviation: { type: String },
  order: { type: Number },
  orderSequence: { type: Number, unique: true, sparse: true },
  description: { type: String, default: 'No description provided yet' },
});

module.exports = mongoose.model('currentWarning', currentWarnings, 'currentWarnings');
