const mongoose = require('mongoose');
const Expenditure = require('../../models/bmdashboard/expenditure');
const logger = require('../../startup/logger');

exports.getProjectExpensesPie = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const data = await Expenditure.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: { type: '$type', category: '$category' },
          amount: { $sum: '$amount' },
        },
      },
    ]);

    const result = { actual: [], planned: [] };

    data.forEach((item) => {
      const { type, category } = item._id;
      result[type].push({ category, amount: item.amount });
    });

    return res.json(result);
  } catch (error) {
    logger.logException(error, 'expenditureController.getProjectExpensesPie', {
      projectId: req.params.projectId,
    });
    return res.status(500).json({ message: 'Server error retrieving expenses pie data.' });
  }
};

exports.getProjectIdsWithExpenditure = async (_req, res) => {
  try {
    const projectIds = await Expenditure.distinct('projectId');
    return res.status(200).json(projectIds);
  } catch (error) {
    logger.logException(error, 'expenditureController.getProjectIdsWithExpenditure');
    return res.status(500).json({ message: 'Failed to retrieve project IDs' });
  }
};
