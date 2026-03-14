const mongoose = require('mongoose');

const stateIndicatorSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  selectedAt: { type: Date, default: Date.now },
});

const userStateSelectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      ref: 'userProfile',
    },
    stateIndicators: [stateIndicatorSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserStateSelection', userStateSelectionSchema);
