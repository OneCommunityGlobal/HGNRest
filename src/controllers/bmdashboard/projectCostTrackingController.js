const projectCostTrackingController = function (ProjectCostTracking) {
  const getProjectCosts = async (req, res) => {
    try {
      const { id } = req.params;
      const { categories, fromDate, toDate } = req.query;

      // Build query
      const query = { projectId: id };

      // Add category filter if provided
      if (categories) {
        const categoryList = categories.split(',');
        query.category = { $in: categoryList };
      }

      // Add date range filter if provided
      if (fromDate || toDate) {
        query.date = {};
        if (fromDate) query.date.$gte = new Date(fromDate);
        if (toDate) query.date.$lte = new Date(toDate);
      }

      // Get actual cost data
      const costData = await ProjectCostTracking.find(query).sort({ date: 1 });

      // Process data for response
      const result = {
        actual: {},
        predicted: {},
        plannedBudget: 10000, // This would typically come from project data
      };

      // Group by category
      const categorizedData = {};
      costData.forEach((entry) => {
        if (!categorizedData[entry.category]) {
          categorizedData[entry.category] = [];
        }
        categorizedData[entry.category].push({
          date: entry.date,
          cost: entry.cost,
        });
      });

      // Calculate total costs
      categorizedData.Total = [];
      const dateMap = new Map();

      costData.forEach((entry) => {
        const dateStr = entry.date.toISOString().split('T')[0];
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { date: entry.date, cost: 0 });
        }
        dateMap.get(dateStr).cost += entry.cost;
      });

      categorizedData.Total = Array.from(dateMap.values());

      // Format actual data
      result.actual = categorizedData;

      // Generate simple prediction data (for demonstration)
      // In a real app, this would use a more sophisticated prediction algorithm
      if (costData.length > 0) {
        const lastDate = new Date(Math.max(...costData.map((entry) => entry.date)));
        const predictedData = {};

        Object.keys(categorizedData).forEach((category) => {
          if (categorizedData[category].length > 0) {
            // Simple linear projection for next 3 months
            const categoryData = categorizedData[category];
            const lastEntry = categoryData[categoryData.length - 1];

            // Calculate average daily cost
            const avgDailyCost = lastEntry.cost / 30; // Simplified assumption

            predictedData[category] = [];
            for (let i = 1; i <= 3; i++) {
              const predictedDate = new Date(lastDate);
              predictedDate.setMonth(lastDate.getMonth() + i);

              predictedData[category].push({
                date: predictedDate,
                cost: lastEntry.cost + avgDailyCost * 30 * i,
              });
            }
          }
        });

        result.predicted = predictedData;
      }

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const getAllProjectIds = async (req, res) => {
    try {
      // Using MongoDB's distinct to get unique project IDs
      const projectIds = await ProjectCostTracking.distinct('projectId');
      res.status(200).json({ projectIds });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getProjectCosts,
    getAllProjectIds,
  };
};

module.exports = projectCostTrackingController;
