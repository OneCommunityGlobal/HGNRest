const mongoose = require('mongoose');

const { Schema } = mongoose;

const savedFilterSchema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 5,
    trim: true,
  },
  filterConfig: {
    selectedCodes: [{ type: String }],
    selectedOverTime: { type: Boolean, default: false },
    selectedBioStatus: { type: Boolean, default: false },
    selectedTrophies: { type: Boolean, default: false },
    selectedSpecialColors: {
      purple: { type: Boolean, default: false },
      green: { type: Boolean, default: false },
      navy: { type: Boolean, default: false },
    },
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
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

// Update the updatedAt field on save
savedFilterSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create compound index for name uniqueness
savedFilterSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('savedFilter', savedFilterSchema, 'savedFilters');
