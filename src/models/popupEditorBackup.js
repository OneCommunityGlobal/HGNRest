const mongoose = require('mongoose');

const { Schema } = mongoose;

const popupEditorBackupSchema = new Schema({
  popupId: { type: mongoose.SchemaTypes.ObjectId, ref: 'popupEditor' },
  popupName: { type: String, required: true },
  popupContent: { type: String, required: true },
});

module.exports = mongoose.model('popupEditorBackup', popupEditorBackupSchema, 'popupEditorBackup');
