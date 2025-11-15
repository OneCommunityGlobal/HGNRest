const mongoose = require('mongoose');

const { Schema } = mongoose;

const studentAtomSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  atomId: {
    type: Schema.Types.ObjectId,
    ref: 'Atom',
    required: true,
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started',
  },
  notes: {
    type: String,
  },
  firstStartedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('studentAtom', studentAtomSchema);
