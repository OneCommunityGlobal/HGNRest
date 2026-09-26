const mongoose = require('mongoose');

const { Schema } = mongoose;

const currentWarnings = new Schema({
  warningTitle: { type: String, required: true, index: true },
  activeWarning: { type: Boolean, required: true },
  isPermanent: { type: Boolean, required: true },
  isSpecial: { type: Boolean },
  abbreviation: { type: String },
  order: { type: Number },
  description: { type: String, default: 'No description provided yet' },
});

module.exports = mongoose.model('currentWarning', currentWarnings, 'currentWarnings');
