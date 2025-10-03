const mongoose = require('mongoose');

const { Schema } = mongoose;

const atomSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  color_level: {
    type: String,
    required: true,
    enum: ['Blue', 'Green', 'Orange', 'Red', 'Yellow', 'Purple'],
  },
  description: {
    type: String,
    trim: true,
  },
  difficulty_level: {
    type: Number,
    min: 1,
    max: 10,
    default: 1,
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

atomSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

atomSchema.index({ color_level: 1 });
atomSchema.index({ difficulty_level: 1 });
atomSchema.index({ isActive: 1 });

module.exports = mongoose.model('Atom', atomSchema, 'atoms');