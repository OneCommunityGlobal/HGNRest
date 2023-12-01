const mongoose = require('mongoose');

const { Schema } = mongoose;

const title = new Schema({
  titleName: { type: String, required: true },
  teamCode: { type: String, require: true },
  projectAssigned: { type: String, required: true },
  mediaFolder: { type: String, require: true },
  teamAssiged: { type: String },
  shortName: { type: String, require: true },

});

module.exports = mongoose.model('title', title, 'titles');
