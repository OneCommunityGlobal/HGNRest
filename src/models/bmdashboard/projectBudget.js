const mongoose = require('mongoose');

const { Schema } = mongoose;

const amount = { type: Number, min: 0 };

// Planned budget for a BM project, split by cost category (Labor / Materials / Equipment)
// and optionally by expenditure type. Feeds the planned side of the Financials charts.
const budgetFields = {
  categories: {
    labor: { ...amount, required: true },
    materials: { ...amount, required: true },
    equipment: { ...amount, required: true },
  },
  expenditureTypes: {
    plumbing: amount,
    electrical: amount,
    structural: amount,
    mechanical: amount,
  },
  // Date the budget applies from, picked by the user
  effectiveDate: { type: Date, required: true },
  setBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
};

const projectBudgetSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'buildingProject',
      required: true,
      unique: true,
    },
    ...budgetFields,
    // Earlier versions, newest first, so edits keep an audit trail
    history: [
      new Schema({ ...budgetFields, setAt: { type: Date, required: true } }, { _id: false }),
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model('ProjectBudget', projectBudgetSchema, 'projectBudgets');
