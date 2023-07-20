const mongoose = require('mongoose');

const { Schema } = mongoose;

const informationchema = new Schema({
  infoName: { type: String, required: true, unique: true },
  infoContent: { type: String},
});

module.exports = mongoose.model('information', informationchema, 'informations');
