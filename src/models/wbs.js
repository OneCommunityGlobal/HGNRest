const mongoose = require('mongoose');

const { Schema } = mongoose;

const wbsschema = new Schema({

  wbsName: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },

});

module.exports = mongoose.model('wbs', wbsschema, 'wbss');
