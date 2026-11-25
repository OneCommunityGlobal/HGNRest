const mongoose = require('mongoose');

// Keep snapshots with the audit entry so undo never relies on browser state.
const lessonTagBatchSchema = new mongoose.Schema({
  actor: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
  operation: { type: String, enum: ['add', 'remove'], required: true },
  tags: [String],
  changes: [
    {
      lessonId: { type: mongoose.SchemaTypes.ObjectId, required: true },
      title: String,
      before: [String],
      after: [String],
    },
  ],
  createdAt: { type: Date, default: Date.now },
  undoneAt: Date,
  undoneBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
});

lessonTagBatchSchema.index({ actor: 1, createdAt: -1 });
module.exports = mongoose.model('LessonTagBatch', lessonTagBatchSchema);
