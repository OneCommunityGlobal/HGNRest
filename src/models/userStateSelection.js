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
    selections: { type: [SelectionSchema], default: [] },
  },
  { timestamps: true }
);

UserStateSelectionSchema.index({ userId: 1, 'selections.key': 1 });

module.exports = mongoose.model('user_state_selection', UserStateSelectionSchema);
