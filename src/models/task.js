const mongoose = require('mongoose');
// const TERMINAL = new Set(['Completed', 'Closed']);
const TERMINAL = new Set(['Completed', 'Closed', 'Complete']);
const { Schema } = mongoose;

const taskschema = new Schema({
  taskName: { type: String, required: true },
  wbsId: { type: mongoose.SchemaTypes.ObjectId, ref: 'wbs', required: true },
  num: { type: String, required: true },
  level: { type: Number, required: true },
  priority: { type: String, default: 'Primary' },
  resources: [
    {
      name: { type: String, required: true },
      userID: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfiles' },
      profilePic: { type: String },
      completedTask: { type: Boolean, default: false },
      reviewStatus: { type: String, default: 'Unsubmitted' },
    },
  ],
  isAssigned: { type: Boolean, default: true },
  status: { type: String, default: 'Not Started' },
  hoursBest: { type: Number, default: 0.0 },
  hoursWorst: { type: Number, default: 0.0 },
  hoursMost: { type: Number, default: 0.0 },
  hoursLogged: { type: Number, default: 0.0 },
  estimatedHours: { type: Number, default: 0.0 },
  startedDatetime: { type: Date },
  dueDatetime: { type: Date },
  links: [String],
  relatedWorkLinks: [String],
  category: { type: String },
  deadlineCount: { type: Number, default: 0.0 },
  parentId1: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'task',
    default: null,
  },
  parentId2: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'task',
    default: null,
  },
  parentId3: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'task',
    default: null,
  },
  mother: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  position: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  hasChild: { type: Boolean, default: false },
  childrenQty: { type: Number, default: 0, required: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
  whyInfo: { type: String },
  intentInfo: { type: String },
  endstateInfo: { type: String },
  classification: { type: String },
  completedDatetime: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
  // Flag to indicate if task category differs from project category (display purpose)
  // false = task category matches project category
  // true = task category differs from project category
  categoryOverride: {
    type: Boolean,
    default: false,
  },
  // Flag to prevent category cascade when project category changes
  // false = task category will cascade with project category changes (default)
  // true = task category is locked and will NOT cascade
  // This is set by explicit user action (e.g., lock button) or when user manually sets category
  categoryLocked: {
    type: Boolean,
    default: false,
  },
});

taskschema.index({ completedDatetime: 1 });
taskschema.index({ createdDatetime: 1 });
taskschema.index({ status: 1, createdDatetime: 1 });

// If status flips to Completed and no timestamp yet, stamp it.
taskschema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (TERMINAL.has(this.status) && !this.completedDatetime) {
      // entering Completed/Closed → stamp if missing
      this.completedDatetime = new Date(); // UTC
    }
    if (!TERMINAL.has(this.status) && this.isModified('status')) {
      // leaving terminal → clear
      // only clear if previously terminal (we can’t easily know prev here on save, so be conservative)
      // If you want precise behavior here, do it in the update middleware below.
    }
  }
  next();
});

function stampCompletedOnUpdate(update, prevStatus) {
  // Normalize to use $set
  const $set = update.$set || {};
  const nextStatus = $set.status ?? update.status;

  if (!nextStatus) return update;

  // Entering a terminal status
  if (TERMINAL.has(nextStatus) && !TERMINAL.has(prevStatus)) {
    // Only stamp if caller didn’t pass one explicitly
    if ($set.completedDatetime === undefined && update.completedDatetime === undefined) {
      $set.completedDatetime = new Date();
    }
  }

  // Leaving a terminal status (reopen)
  if (!TERMINAL.has(nextStatus) && TERMINAL.has(prevStatus)) {
    if ($set.completedDatetime === undefined && update.completedDatetime === undefined) {
      $set.completedDatetime = null;
    }
  }

  if (Object.keys($set).length) update.$set = $set;
  return update;
}

async function preAnyUpdate(next) {
  try {
    const query = this.getQuery();
    const update = this.getUpdate() || {};
    // Fetch prior status to detect transitions
    const prev = await this.model.findOne(query).select('status').lean();

    if (prev) {
      stampCompletedOnUpdate(update, prev.status);
      this.setUpdate(update);
    }
    next();
  } catch (e) {
    next(e);
  }
}

taskschema.pre('findOneAndUpdate', preAnyUpdate);
taskschema.pre('updateOne', preAnyUpdate);

module.exports = mongoose.model('task', taskschema, 'tasks');
