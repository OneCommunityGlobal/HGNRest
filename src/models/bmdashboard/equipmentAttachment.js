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
  removedAt: Date,
  changes: [
    {
      timestamp: Date,
      actor: { type: Schema.Types.ObjectId, ref: 'userProfile' },
      field: String,
      oldValue: String,
      newValue: String,
    },
  ],
  content: { type: Buffer, required: true, select: false },
});

module.exports = mongoose.model('equipmentAttachment', equipmentAttachment);
