const mongoose = require('mongoose');

const { Schema } = mongoose;

const currentWarnings = new Schema({
  warningTitle: { type: String, required: true },
  activeWarning: { type: Boolean, required: true },
  isPermanent: { type: Boolean, required: true },
  isSpecial: { type: Boolean, required: true },
  abbreviation: { type: String },
});

module.exports = mongoose.model('currentWarning', currentWarnings, 'currentWarnings');
