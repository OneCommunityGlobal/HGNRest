const mongoose = require('mongoose');

const { Schema } = mongoose;

const studentTaskSchema = new Schema({
  student_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  task_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'task',
    required: true,
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'submitted', 'reviewed'],
    default: 'not_started',
  },
  due_date: {
    type: Date,
    required: true,
  },
  subject_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Subject',
    required: true,
  },
  atom_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Atom',
    required: true,
  },
  activity_group_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Strategy',
  },
  teaching_strategy_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Strategy',
  },
  life_strategy_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Strategy',
  },
  progress_percent: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  submitted_at: {
    type: Date,
  },
  reviewed_at: {
    type: Date,
  },
  grade: {
    type: Number,
    min: 0,
    max: 100,
  },
  feedback: {
    type: String,
  },
  assigned_at: {
    type: Date,
    default: Date.now,
    required: true,
  },
  started_at: {
    type: Date,
  },
  completed_at: {
    type: Date,
  },
  created_at: {
    type: Date,
    default: Date.now,
    required: true,
  },
  updated_at: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

studentTaskSchema.pre('save', function(next) {
  this.updated_at = Date.now();

  if (this.status === 'in_progress' && !this.started_at) {
    this.started_at = Date.now();
  }

  if (this.status === 'completed' && !this.completed_at) {
    this.completed_at = Date.now();
    this.progress_percent = 100;
  }

  if (this.status === 'submitted' && !this.submitted_at) {
    this.submitted_at = Date.now();
  }

  if (this.status === 'reviewed' && !this.reviewed_at) {
    this.reviewed_at = Date.now();
  }

  next();
});

studentTaskSchema.index({ student_id: 1 });
studentTaskSchema.index({ task_id: 1 });
studentTaskSchema.index({ subject_id: 1 });
studentTaskSchema.index({ atom_id: 1 });
studentTaskSchema.index({ status: 1 });
studentTaskSchema.index({ due_date: 1 });
studentTaskSchema.index({ student_id: 1, status: 1 });
studentTaskSchema.index({ student_id: 1, subject_id: 1 });

module.exports = mongoose.model('StudentTask', studentTaskSchema, 'studentTasks');