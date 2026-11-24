const mongoose = require('mongoose');
const Expenditure = require('../../models/bmdashboard/expenditure');
const ProjectBudget = require('../../models/bmdashboard/projectBudget');
const logger = require('../../startup/logger');
const { getProjectBudget, toCategoryList } = require('../../utilities/projectBudgetHelper');

exports.getProjectExpensesPie = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    // Actual amounts come from expenditure records; planned amounts come from the project's
    // budget (set on the Project Dashboard), so seeded planned records are no longer used.
    const [data, budget] = await Promise.all([
      Expenditure.aggregate([
        { $match: { projectId: new mongoose.Types.ObjectId(projectId), type: 'actual' } },
        {
          $group: {
            _id: '$category',
            amount: { $sum: '$amount' },
          },
        },
      ]),
      getProjectBudget(projectId),
    ]);

    return res.json({
      actual: data.map((item) => ({ category: item._id, amount: item.amount })),
      planned: toCategoryList(budget),
      hasBudget: Boolean(budget),
    });
  } catch (error) {
    logger.logException(error, 'expenditureController.getProjectExpensesPie', {
      projectId: req.params.projectId,
    });
    return res.status(500).json({ message: 'Server error retrieving expenses pie data.' });
  }
};

// Projects with actual expenditure or a planned budget
exports.getProjectIdsWithExpenditure = async (_req, res) => {
  try {
    const [expenditureIds, budgetIds] = await Promise.all([
      Expenditure.distinct('projectId'),
      ProjectBudget.distinct('projectId'),
    ]);
    const unique = new Map([...expenditureIds, ...budgetIds].map((id) => [String(id), id]));
    return res.status(200).json([...unique.values()]);
  } catch (error) {
    logger.logException(error, 'expenditureController.getProjectIdsWithExpenditure');
    return res.status(500).json({ message: 'Failed to retrieve project IDs' });
  }
};
