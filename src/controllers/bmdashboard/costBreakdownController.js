/* eslint-disable prefer-template */
/* eslint-disable one-var */
const moment = require('moment');

const costBreakdownController = (costBreakdown) => {
  /**
   * Get actual cost breakdown for a project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getActualCostBreakdown = async (req, res) => {
    try {
      const { id } = req.params;
      const { fromDate, toDate } = req.query;

      // Create date filters
      const dateFilter = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) dateFilter.$lte = new Date(toDate);

      // Query for current period data
      const filter = { projectId: id };
      if (fromDate || toDate) filter.date = dateFilter;

      const currentData = await costBreakdown.aggregate([
        { $match: filter },
        { $group: {
            _id: '$category',
            totalCost: { $sum: '$cost' }
          }
        }
      ]);

      // Create the result structure
      const result = {
        current: {
          plumbing: 0,
          electrical: 0,
          structural: 0,
          mechanical: 0
        },
        previousMonthTotal: 0
      };

      // Populate current data
      currentData.forEach(item => {
        const category = item._id.toLowerCase();
        result.current[category] = item.totalCost;
      });

      // Calculate current total
      const currentTotal = Object.values(result.current).reduce((sum, cost) => sum + cost, 0);

      // Get previous month's data
      let previousMonthStart, previousMonthEnd;

      if (fromDate && toDate) {
        const currentPeriodStart = moment(fromDate);
        const currentPeriodEnd = moment(toDate);
        const daysDiff = currentPeriodEnd.diff(currentPeriodStart, 'days');

        previousMonthStart = moment(currentPeriodStart).subtract(daysDiff, 'days');
        previousMonthEnd = moment(currentPeriodStart).subtract(1, 'day');
      } else {
        // Default to last month
        previousMonthStart = moment().subtract(1, 'month').startOf('month');
        previousMonthEnd = moment().subtract(1, 'month').endOf('month');
      }

      const previousMonthFilter = {
        projectId: id,
        date: {
          $gte: previousMonthStart.toDate(),
          $lte: previousMonthEnd.toDate()
        }
      };

      const previousMonthData = await costBreakdown.aggregate([
        { $match: previousMonthFilter },
        { $group: {
            _id: null,
            totalCost: { $sum: '$cost' }
          }
        }
      ]);

      if (previousMonthData.length > 0) {
        result.previousMonthTotal = previousMonthData[0].totalCost;
      }

      // Add the current total to the result
      result.currentTotal = currentTotal;

      // Calculate percentage change
      if (result.previousMonthTotal > 0) {
        result.percentageChange = ((currentTotal - result.previousMonthTotal) / result.previousMonthTotal) * 100;
      } else {
        result.percentageChange = 100; // If previous is 0, assume 100% increase
      }

      res.json(result);
    } catch (error) {
      console.error('Error fetching cost breakdown:', error);
      res.status(500).json({ error: 'Failed to fetch cost breakdown data' });
    }
  };

  /**
   * Get all expenditure records
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getAllExpenditure = async (req, res) => {
    try {
      const expenditures = await costBreakdown.find()
        .select('projectId date category cost')
        .lean()
        .exec();

      // Transform data 
      const transformedExpenditures = expenditures.map(expenditure => ({
        projectId: expenditure.projectId,
        date: expenditure.date,
        category: expenditure.category,
        cost: expenditure.cost,
      }));

      res.status(200).json({
        success: true,
        data: transformedExpenditures
      });
    } catch (err) {
      console.error("Error in getAllExpenditure:", err);
      res.status(500).json({
        success: false,
        error: 'Server error ' + err.message
      });
    }
  };

  return {
    getActualCostBreakdown,
    getAllExpenditure
  };
};

module.exports = costBreakdownController;
