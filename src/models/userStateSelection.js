const mongoose = require('mongoose');

const UserStateSelectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, unique: true },
    stateIndicators: { type: [String], default: [] }, 
  },
  { timestamps: true }
);

module.exports = mongoose.model('user_state_selection', UserStateSelectionSchema);
