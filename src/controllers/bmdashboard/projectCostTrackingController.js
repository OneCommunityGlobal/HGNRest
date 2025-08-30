const projectCostTrackingController = function (ProjectCostTracking) {
  // Simple linear regression class compatible with older Node.js versions
  class SimpleLinearRegression {
    constructor(x, y) {
      if (x.length !== y.length) {
        throw new Error('X and Y arrays must have the same length');
      }

      const n = x.length;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
      const sumXX = x.reduce((a, b) => a + b * b, 0);

      // Calculate slope and intercept
      this.slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      this.intercept = (sumY - this.slope * sumX) / n;
    }

    predict(x) {
      return this.slope * x + this.intercept;
    }
  }
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

      // Calculate cumulative costs for each category
      Object.keys(categorizedData).forEach((category) => {
        let cumulativeCost = 0;
        categorizedData[category] = categorizedData[category].map((item) => {
          cumulativeCost += item.cost;
          return {
            date: item.date,
            cost: cumulativeCost,
          };
        });
      });

      // Calculate total costs
      const dateMap = new Map();

      costData.forEach((entry) => {
        const dateStr = entry.date.toISOString().split('T')[0];
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { date: entry.date, cost: 0 });
        }
        dateMap.get(dateStr).cost += entry.cost;
      });

      // Convert to array and calculate cumulative total
      let totalCumulative = 0;
      const totalCosts = Array.from(dateMap.values())
        .sort((a, b) => a.date - b.date)
        .map((item) => {
          totalCumulative += item.cost;
          return {
            date: item.date,
            cost: totalCumulative,
          };
        });

      if (totalCosts.length > 0) {
        categorizedData.Total = totalCosts;
      }

      // Format actual data
      result.actual = categorizedData;

      // Generate prediction data using linear regression
      if (costData.length > 0) {
        const predictedData = {};

        // For each category, perform linear regression
        Object.keys(categorizedData).forEach((category) => {
          if (categorizedData[category].length > 0) {
            const categoryData = categorizedData[category];

            // Get the last actual data point
            const lastEntry = categoryData[categoryData.length - 1];

            // Prepare data for linear regression
            const xValues = categoryData.map((item, index) => index); // Use indices as x values
            const yValues = categoryData.map((item) => item.cost);

            // Linear regression using ml-regression library
            const regression = new SimpleLinearRegression(xValues, yValues);

            // Function to predict value
            const predict = (x) => regression.predict(x);

            // Generate predictions for next 3 months
            predictedData[category] = [];

            // Get the last date
            const lastDate = new Date(lastEntry.date);
            const lastValue = lastEntry.cost;

            // Calculate the final predicted value for 3 months ahead
            // This ensures we have a perfect linear growth between the last actual point
            // and the final prediction point
            const finalPredictedValue = predict(xValues.length + 2); // +2 for 3 months ahead (0-indexed)

            // Calculate the monthly growth rate for a perfect straight line
            const monthlyGrowth = (finalPredictedValue - lastValue) / 3;

            // Generate predictions for the next 3 months with perfect linear growth
            for (let i = 1; i <= 3; i++) {
              const predictedDate = new Date(lastDate);
              predictedDate.setMonth(lastDate.getMonth() + i);

              // Apply perfect linear growth
              const predictedCost = lastValue + monthlyGrowth * i;

              // Ensure predicted value is not less than the last actual value
              // This prevents negative growth which doesn't make sense for cumulative costs
              const finalCost = Math.max(predictedCost, lastValue);

              predictedData[category].push({
                date: predictedDate,
                cost: finalCost,
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
