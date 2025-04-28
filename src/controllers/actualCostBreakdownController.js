const Cost = require('../models/Expenditure'); // Correct model
const mongoose = require('mongoose');
const moment = require('moment');

exports.getActualCostBreakdown = async (req, res) => {
  try {
    const { id } = req.params;
    const { fromDate, toDate } = req.query;

    const match = { projectId: new mongoose.Types.ObjectId(id) };

    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) match.date.$gte = new Date(fromDate);
      if (toDate) match.date.$lte = new Date(toDate);
    }

    console.log('Query match:', match);

    const currentAggregation = await Cost.aggregate([
      { $match: match },
      { $project: { categoryLower: { $toLower: "$category" }, cost: 1 } },
      { $group: { _id: "$categoryLower", total: { $sum: "$cost" } } }
    ]);

    const current = { plumbing: 0, electrical: 0, structural: 0, mechanical: 0 };
    currentAggregation.forEach(item => {
      if (current[item._id] !== undefined) {
        current[item._id] = item.total;
      }
    });

    const currentTotal = Object.values(current).reduce((sum, val) => sum + val, 0);

    const previousMonthStart = moment(fromDate || new Date()).subtract(1, 'month').startOf('month').toDate();
    const previousMonthEnd = moment(fromDate || new Date()).subtract(1, 'month').endOf('month').toDate();

    const previousAggregation = await Cost.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(id),
          date: { $gte: previousMonthStart, $lte: previousMonthEnd }
        }
      },
      { $group: { _id: null, total: { $sum: "$cost" } } }
    ]);

    const previousMonthTotal = previousAggregation.length ? previousAggregation[0].total : 0;

    // ✅ Safe percentage calculation
    let percentageChange = 0;
    if (previousMonthTotal !== null && previousMonthTotal !== undefined && previousMonthTotal !== 0) {
      percentageChange = ((currentTotal - previousMonthTotal) / previousMonthTotal) * 100;
    }

    res.json({ current, previousMonthTotal, percentageChange });
  } catch (error) {
    console.error('Error fetching cost breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch cost breakdown' });
  }
};
