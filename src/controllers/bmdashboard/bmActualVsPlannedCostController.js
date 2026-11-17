const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const Expenditure = require('../../models/bmdashboard/expenditure');
const logger = require('../../startup/logger');

const CATEGORIES = ['Labor', 'Equipment', 'Materials'];

const getExpensesByProject = async (req, res) => {
  const { projectId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const project = await BuildingProject.findById(projectId).lean();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const expenses = await Expenditure.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: { type: '$type', category: '$category' },
          amount: { $sum: '$amount' },
        },
      },
    ]);

    const byTypeAndCategory = new Map(
      expenses.map(({ _id, amount }) => [`${_id.type}:${_id.category}`, amount]),
    );
    const breakdown = CATEGORIES.map((category) => ({
      category,
      actualCost: byTypeAndCategory.get(`actual:${category}`) || 0,
      plannedCost: byTypeAndCategory.get(`planned:${category}`) || 0,
    }));

    return res.json({
      projectId,
      projectName: project.name,
      totalActualCost: breakdown.reduce((total, item) => total + item.actualCost, 0),
      totalPlannedCost: breakdown.reduce((total, item) => total + item.plannedCost, 0),
      breakdown,
    });
  } catch (error) {
    logger.logException(error, 'bmActualVsPlannedCostController.getExpensesByProject', {
      projectId,
    });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { getExpensesByProject };
