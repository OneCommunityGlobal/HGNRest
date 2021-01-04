const mongoose = require('mongoose');

const { Schema } = mongoose;

const popupEditorschema = new Schema({
  popupName: { type: String, required: true },
  popupContent: { type: String, required: true },
});

module.exports = mongoose.model('popupEditor', popupEditorschema, 'popupEditor');
