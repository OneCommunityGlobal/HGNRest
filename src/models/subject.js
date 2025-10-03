const mongoose = require('mongoose');

const { Schema } = mongoose;

const subjectSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    default: '#007bff',
  },
  isActive: {
    type: Boolean,
    default: true,
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

subjectSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

subjectSchema.index({ name: 1 });
subjectSchema.index({ isActive: 1 });

module.exports = mongoose.model('Subject', subjectSchema, 'subjects');