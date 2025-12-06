const mongoose = require('mongoose');

const { Schema } = mongoose;

const strategySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['activity_group', 'teaching_strategy', 'life_strategy'],
  },
  description: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    default: '#6c757d',
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

strategySchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

strategySchema.index({ type: 1 });
strategySchema.index({ name: 1 });
strategySchema.index({ isActive: 1 });

module.exports = mongoose.model('Strategy', strategySchema, 'strategies');
