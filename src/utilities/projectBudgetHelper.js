const mongoose = require('mongoose');
const ProjectBudget = require('../models/bmdashboard/projectBudget');

// Category keys stored on the budget -> names the Financials charts use
const CATEGORY_LABELS = {
  labor: 'Labor',
  materials: 'Materials',
  equipment: 'Equipment',
};

const EXPENDITURE_TYPE_KEYS = ['plumbing', 'electrical', 'structural', 'mechanical'];

// The project's current budget, or null when none is set (or the id is invalid)
const getProjectBudget = async (projectId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) return null;
  return ProjectBudget.findOne({ projectId }).lean();
};

const budgetTotal = (budget) =>
  Object.keys(CATEGORY_LABELS).reduce((sum, key) => sum + (budget?.categories?.[key] || 0), 0);

// [{ category: 'Labor', amount }, ...] in chart naming; empty when there is no budget
const toCategoryList = (budget) =>
  budget
    ? Object.entries(CATEGORY_LABELS).map(([key, category]) => ({
        category,
        amount: budget.categories?.[key] || 0,
      }))
    : [];

module.exports = {
  CATEGORY_LABELS,
  EXPENDITURE_TYPE_KEYS,
  getProjectBudget,
  budgetTotal,
  toCategoryList,
};
