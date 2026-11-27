const mongoose = require('mongoose');

const { Schema } = mongoose;

const equipmentAttachment = new Schema({
  equipment: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploader: { type: Schema.Types.ObjectId, ref: 'userProfile', required: true },
  uploadedAt: { type: Date, default: Date.now },
  content: { type: Buffer, required: true, select: false },
});

module.exports = mongoose.model('equipmentAttachment', equipmentAttachment);
