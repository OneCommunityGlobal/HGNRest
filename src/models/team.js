const mongoose = require('mongoose');

const { Schema } = mongoose;

const team = new Schema({

  teamName: { type: 'String', required: true },
  isActive: { type: 'Boolean', required: true, default: true },
  createdDateTime: { type: Date },
  modifiedDateTime: { type: Date, default: Date.now() },

});

module.exports = mongoose.model('team', team, 'teams');
