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
    enum: ['teaching_strategy', 'life_strategy', 'activity_group'],
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

strategySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

strategySchema.index({ type: 1 });
strategySchema.index({ name: 1 });
strategySchema.index({ isActive: 1 });

module.exports = mongoose.model('Strategy', strategySchema);
