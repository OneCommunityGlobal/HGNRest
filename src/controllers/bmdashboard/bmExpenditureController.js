/* eslint-disable no-console */
const moment = require('moment');
const Expenditures = require('../../models/bmdashboard/buildingExpenditure');

const COST_BREAKDOWN_CATEGORIES = new Set(['plumbing', 'electrical', 'structural', 'mechanical']);
const ALL_PROJECTS_ID = 'all';

const bmExpenditureController = {
  // retrieve all expenditure data
  getAllExpenditure: async (req, res) => {
    try {
      const expenditures = await Expenditures.find()
        .select('projectId date category cost')
        .lean()
        .exec();

      // transform data for frontend chart
      const transformedExpenditures = expenditures.map((expenditure) => ({
        projectId: expenditure.projectId,
        date: expenditure.date,
        category: expenditure.category,
        cost: expenditure.cost,
      }));

      res.status(200).json({
        success: true,
        data: transformedExpenditures,
      });
    } catch (err) {
      console.error('Error in getAllExpenditure:', err);
      res.status(500).json({
        success: false,
        error: `Server error ${err.message}`,
      });
    }
  },

  // GET /api/projects/with-expenditure
  // Distinct project ids that have at least one expenditure entry, for populating
  // the project filter dropdown on the Cost Breakdown by Type of Expenditure chart.
  getProjectIdsWithExpenditure: async (req, res) => {
    try {
      const projectIds = await Expenditures.distinct('projectId');
      return res.status(200).json({ success: true, data: projectIds });
    } catch (err) {
      console.error('Error in getProjectIdsWithExpenditure:', err);
      return res.status(500).json({
        success: false,
        error: `Server error ${err.message}`,
      });
    }
  },

  // GET /api/projects/:id/cost-breakdown
  // Aggregates raw expenditure entries into a per-month, per-category cost breakdown
  // for the Cost Breakdown by Type of Expenditure chart. Pass id="all" to aggregate
  // across every project.
  getCostBreakdown: async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ success: false, error: 'projectId is required' });
      }

      // Coerce to a primitive string before it reaches the aggregation pipeline.
      // aggregate() sends $match straight to MongoDB with no Mongoose schema casting,
      // so passing the raw param through unsanitized would let an object value
      // (e.g. { $ne: null }) inject a query operator instead of matching a literal id.
      const projectMatch = projectId === ALL_PROJECTS_ID ? {} : { projectId: String(projectId) };

      // normalizedDate is excluded from being null so we always filter out rows whose
      // `date` couldn't be coerced (see the $addFields stage below).
      const normalizedDateMatch = { $ne: null };
      if (startDate) {
        const from = new Date(startDate);
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({ success: false, error: 'Invalid startDate' });
        }
        normalizedDateMatch.$gte = from;
      }
      if (endDate) {
        const to = new Date(endDate);
        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({ success: false, error: 'Invalid endDate' });
        }
        normalizedDateMatch.$lte = to;
      }

      const grouped = await Expenditures.aggregate([
        { $match: projectMatch },
        {
          // Some expenditure rows have `date` stored as a string rather than a BSON date,
          // which makes $year/$month throw. $convert coerces it, turning unparseable rows
          // into null (onError/onNull) so they can be filtered out instead of crashing.
          $addFields: {
            normalizedDate: {
              $convert: { input: '$date', to: 'date', onError: null, onNull: null },
            },
          },
        },
        { $match: { normalizedDate: normalizedDateMatch } },
        {
          $group: {
            _id: {
              year: { $year: '$normalizedDate' },
              month: { $month: '$normalizedDate' },
              category: '$category',
            },
            totalCost: { $sum: '$cost' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);

      const monthsByKey = new Map();

      grouped.forEach(({ _id, totalCost }) => {
        const { year, month, category } = _id;
        const key = `${year}-${month}`;

        if (!monthsByKey.has(key)) {
          monthsByKey.set(key, {
            month: moment({ year, month: month - 1 }).format('MMM YYYY'),
            plumbing: 0,
            electrical: 0,
            structural: 0,
            mechanical: 0,
          });
        }

        const categoryKey = String(category).toLowerCase();
        if (COST_BREAKDOWN_CATEGORIES.has(categoryKey)) {
          monthsByKey.get(key)[categoryKey] = totalCost;
        }
      });

      return res.status(200).json({ actual: Array.from(monthsByKey.values()) });
    } catch (err) {
      console.error('Error in getCostBreakdown:', err);
      return res.status(500).json({
        success: false,
        error: `Server error ${err.message}`,
      });
    }
  },
};

module.exports = bmExpenditureController;
