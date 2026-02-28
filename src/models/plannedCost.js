const mongoose = require('mongoose');

const { Schema } = mongoose;

const plannedCostSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'project',
    required: true,
  },
  category: {
    type: String,
    enum: ['Plumbing', 'Electrical', 'Structural', 'Mechanical'],
    required: true,
  },
  plannedCost: {
    type: Number,
    required: true,
    min: 0,
  },
  createdDatetime: {
    type: Date,
    default: Date.now,
  },
  modifiedDatetime: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure unique combination of projectId and category
plannedCostSchema.index({ projectId: 1, category: 1 }, { unique: true });

// Update modifiedDatetime on save
plannedCostSchema.pre('save', function (next) {
  this.modifiedDatetime = new Date();
  next();
});

module.exports = mongoose.model('plannedCost', plannedCostSchema, 'plannedCosts');
