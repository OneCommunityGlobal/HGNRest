const mongoose = require('mongoose');
const Expenditure = require('../../models/bmdashboard/expenditure');

exports.getProjectExpensesPie = async (req, res) => {
  try {
    const { projectId } = req.params;

    const data = await Expenditure.aggregate([
      { $match: { projectId: mongoose.Types.ObjectId(projectId) } },
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

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving expenses pie data.' });
  }
};
exports.getProjectIdsWithExpenditure = async (req, res) => {
  try {
    const projectIds = await Expenditure.distinct('projectId');
    res.status(200).json(projectIds);
  } catch (error) {
    console.error('Error fetching project IDs:', error);
    res.status(500).json({ message: 'Failed to retrieve project IDs' });
  }
};
