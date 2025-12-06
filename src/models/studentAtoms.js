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

  savedStatus: {
    type: String,
    enum: ['new', 'shortlisted', 'top3'],
    default: 'new',
  },

  isPlanned: {
    type: Boolean,
    default: false,
  },

  lessonPlanDraftId: {
    type: Schema.Types.ObjectId,
    ref: 'LessonPlanDraft',
    default: null,
  },

  notes: String,

  firstStartedAt: Date,
  completedAt: Date,

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

studentAtomSchema.index({ studentId: 1, atomId: 1 }, { unique: true });

studentAtomSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('StudentAtom', studentAtomSchema);
