const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Labor Hours Schema
 * Stores labor hours data for Distribution Pie Chart
 *
 * As per requirement:
 * CREATE TABLE labor_hours (
 *   id INT PRIMARY KEY,
 *   user_id INT,
 *   category VARCHAR(255),
 *   hours INT,
 *   date DATE
 * );
 */
const laborHoursSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  hours: {
    type: Number,
    required: true,
    min: 0,
  },
  date: {
    type: Date,
    required: true,
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

// Indexes for optimized queries
laborHoursSchema.index({ date: 1 });
laborHoursSchema.index({ category: 1 });
laborHoursSchema.index({ date: 1, category: 1 });
laborHoursSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('LaborHours', laborHoursSchema, 'labor_hours');
