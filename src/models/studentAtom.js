const mongoose = require('mongoose');

const studentAtomSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true
  },
  atomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Atom',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    trim: true
  },
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity'
  }
}, {
  timestamps: true
});

// Compound index to ensure unique atom assignment per student
studentAtomSchema.index({ studentId: 1, atomId: 1 }, { unique: true });

module.exports = mongoose.model('StudentAtom', studentAtomSchema);
