const mongoose = require('mongoose');

module.exports = (Expense) => ({
  getExpensesComparison: async (req, res) => {
    const { id: projectId } = req.params;
    const { startDate, endDate, category } = req.query;

    const matchStage = {};

    // --- Debug input ---
    console.log('--- Incoming Request ---');
    console.log('projectId:', projectId);
    console.log('startDate:', startDate);
    console.log('endDate:', endDate);
    console.log('category:', category);

    // Filter by projectId if not "all"
    if (projectId && projectId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(projectId)) {
        matchStage.projectId = new mongoose.Types.ObjectId(projectId);
        console.log('✔ Valid ObjectId:', matchStage.projectId);
      } else {
        return res.status(400).json({ error: 'Invalid projectId format' });
      }
    }

    // Filter by category
    if (category && category.toLowerCase() !== 'all') {
      matchStage.category = category;
    }

    // Filter by date range
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate && !isNaN(new Date(startDate))) dateFilter.$gte = new Date(startDate);
      if (endDate && !isNaN(new Date(endDate))) dateFilter.$lte = new Date(endDate);
      if (Object.keys(dateFilter).length > 0) {
        matchStage.date = dateFilter;
      }
    }

    console.log('Final matchStage:', matchStage);

    try {
      const expenses = await Expense.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'buildingProjects',
            let: { expenseProjectId: { $toString: '$projectId' } },
            pipeline: [
              {
                $addFields: {
                  _idStr: { $toString: '$_id' },
                },
              },
              {
                $match: {
                  $expr: { $eq: ['$_idStr', '$$expenseProjectId'] },
                },
              },
            ],
            as: 'project',
          },
        },
        { $unwind: '$project' },
        {
          $group: {
            _id: {
              projectId: '$projectId',
              projectName: '$project.name',
              category: '$category',
            },
            planned: { $sum: '$plannedCost' },
            actual: { $sum: '$actualCost' },
          },
        },
        {
          $project: {
            _id: 0,
            projectId: '$_id.projectId',
            project: '$_id.projectName',
            category: '$_id.category',
            planned: 1,
            actual: 1,
          },
        },
      ]);

      console.log('📊 Aggregated expenses:', expenses);

      // Final response shaping
      const result = {};
      for (const entry of expenses) {
        const { project, category, planned, actual } = entry;
        if (!result[project]) result[project] = {};
        result[project][category.toLowerCase()] = { planned, actual };
      }

      console.log('Final Response:', result);
      res.json(result);
    } catch (err) {
      console.error('Error fetching expense comparison:', err);
      res.status(500).json({ error: 'Server Error' });
    }
  },
});
