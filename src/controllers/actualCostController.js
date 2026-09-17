const moment = require('moment');
const mongoose = require('mongoose');
const ActualCost = require('../models/actualCost');
const logger = require('../startup/logger');

const actualCostController = function () {
  const getActualCostBreakdown = async function (req, res) {
    try {
      // Check if MongoDB is connected
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).send({
          error: 'Database not connected',
          message:
            'MongoDB connection is not established. Please check your database configuration.',
        });
      }

      const { id: projectId } = req.params;
      const { fromDate, toDate } = req.query;

      // Validate projectId
      if (!projectId) {
        return res.status(400).send({ error: 'Project ID is required' });
      }

      // Convert projectId to ObjectId
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).send({ error: 'Invalid project ID format' });
      }
      const projectObjectId = new mongoose.Types.ObjectId(projectId);

      // Set default date range to current month if not provided
      const startDate = fromDate ? moment(fromDate).startOf('day') : moment().startOf('month');
      const endDate = toDate ? moment(toDate).endOf('day') : moment().endOf('month');

      // Validate date range
      if (!startDate.isValid() || !endDate.isValid()) {
        return res.status(400).send({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      if (startDate.isAfter(endDate)) {
        return res.status(400).send({ error: 'Start date cannot be after end date' });
      }

      // Prepare date objects for query
      const startDateObj = startDate.toDate();
      const endDateObj = endDate.toDate();
      const startDateISO = startDate.toISOString();
      const endDateISO = endDate.toISOString();

      // Get current period cost breakdown
      // Handle both Date object and string date formats
      const matchStage = {
        $and: [
          {
            $or: [{ projectId: projectObjectId }, { projectId }],
          },
          {
            $or: [
              // Try Date object comparison
              {
                date: {
                  $gte: startDateObj,
                  $lte: endDateObj,
                },
              },
              // Try string/ISO comparison (if dates are stored as strings)
              {
                date: {
                  $gte: startDateISO,
                  $lte: endDateISO,
                },
              },
              // Try moment format string
              {
                date: {
                  $gte: startDate.format('YYYY-MM-DD'),
                  $lte: endDate.format('YYYY-MM-DD'),
                },
              },
            ],
          },
        ],
      };

      const currentCosts = await ActualCost.aggregate([
        {
          $match: matchStage,
        },
        {
          $group: {
            _id: '$category',
            totalCost: { $sum: '$cost' },
          },
        },
      ]);

      // Calculate previous month's total for percentage change
      const previousMonthStart = moment(startDate).subtract(1, 'month').startOf('month');
      const previousMonthEnd = moment(startDate).subtract(1, 'month').endOf('month');

      const previousStartDateObj = previousMonthStart.toDate();
      const previousEndDateObj = previousMonthEnd.toDate();
      const previousStartDateISO = previousMonthStart.toISOString();
      const previousEndDateISO = previousMonthEnd.toISOString();

      const previousMatchStage = {
        $and: [
          {
            $or: [{ projectId: projectObjectId }, { projectId }],
          },
          {
            $or: [
              // Try Date object comparison
              {
                date: {
                  $gte: previousStartDateObj,
                  $lte: previousEndDateObj,
                },
              },
              // Try string/ISO comparison
              {
                date: {
                  $gte: previousStartDateISO,
                  $lte: previousEndDateISO,
                },
              },
              // Try moment format string
              {
                date: {
                  $gte: previousMonthStart.format('YYYY-MM-DD'),
                  $lte: previousMonthEnd.format('YYYY-MM-DD'),
                },
              },
            ],
          },
        ],
      };

      const previousMonthCosts = await ActualCost.aggregate([
        {
          $match: previousMatchStage,
        },
        {
          $group: {
            _id: null,
            totalCost: { $sum: '$cost' },
          },
        },
      ]);

      // Format current costs into the required structure
      const current = {
        plumbing: 0,
        electrical: 0,
        structural: 0,
        mechanical: 0,
      };

      currentCosts.forEach((cost) => {
        const category = cost._id.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(current, category)) {
          current[category] = cost.totalCost;
        }
      });

      // Calculate total current cost
      const currentTotal = Object.values(current).reduce((sum, cost) => sum + cost, 0);

      // Get previous month total
      const previousMonthTotal =
        previousMonthCosts.length > 0 ? previousMonthCosts[0].totalCost : 0;

      // Calculate percentage change
      const percentageChange =
        previousMonthTotal > 0
          ? ((currentTotal - previousMonthTotal) / previousMonthTotal) * 100
          : 0;

      const response = {
        current,
        previousMonthTotal,
        percentageChange: Math.round(percentageChange * 100) / 100, // Round to 2 decimal places
        currentTotal,
        dateRange: {
          from: startDate.format('YYYY-MM-DD'),
          to: endDate.format('YYYY-MM-DD'),
        },
      };

      res.status(200).send(response);
    } catch (error) {
      logger.logException(error);
      res.status(500).send({ error: 'Error fetching cost breakdown data' });
    }
  };

  return {
    getActualCostBreakdown,
  };
};

module.exports = actualCostController;
