const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'buildingProject', required: true },
  category: { type: String, enum: ['Plumbing', 'Electrical', 'Structural', 'Mechanical'], required: true },
  plannedCost: { type: Number, required: true },
  actualCost: { type: Number, required: true },
  date: { type: Date, required: true },
});

module.exports = mongoose.model('Expense', ExpenseSchema, 'buildingExpenses');

