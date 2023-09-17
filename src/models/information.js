const mongoose = require('mongoose');

const { Schema } = mongoose;

const informationchema = new Schema({
  infoName: { type: String, required: true, unique: true },
  infoContent: { type: String },
  visibility: { type: String, default: '0' },
});

module.exports = mongoose.model('information', informationchema, 'informations');
