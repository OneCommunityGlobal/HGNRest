const mongoose = require('mongoose');

const { Schema } = mongoose;

const currentWarnings = new Schema({
  warningTitle: { type: String, required: true, index: true },
  activeWarning: { type: Boolean, required: true },
  isPermanent: { type: Boolean, required: true },
});

module.exports = mongoose.model('currentWarning', currentWarnings, 'currentWarnings');
