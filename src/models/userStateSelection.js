// models/userStateSelection.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const SelectionSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    assignedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const UserStateSelectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    // NEW: store objects with dates instead of plain strings
    selections: { type: [SelectionSchema], default: [] },

    // Optional: keep the old field for backward compatibility during migration
    // stateIndicators: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Useful if you’ll query by tag key
UserStateSelectionSchema.index({ userId: 1, 'selections.key': 1 });

module.exports = mongoose.model('user_state_selection', UserStateSelectionSchema);
