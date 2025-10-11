const Issues = require('../../models/bmdashboard/issueAnalytics');

const IssueAnalyticsController = function () {
  const MAX_WEEKS = 12;
  const DEFAULT_WEEKS = 8;
  const TIME_ZONE = 'America/Chicago';

  /**
   * /api/issues/trends
   * Returns weekly issue counts for created and resolved categories.
   */
  const getIssueTrends = async (req, res) => {
    try {
      const { start, end, weeks } = req.query;
      let startDate;
      let endDate;
      let numWeeks;

      // Case 1: Default (no start/end/weeks)
      if (!start && !end && !weeks) {
        numWeeks = DEFAULT_WEEKS;
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(endDate.getDate() - numWeeks * 7);
      }
      // Case 2: weeks provided (4/8/12)
      else if (!start && !end && weeks) {
        numWeeks = parseInt(weeks, 10);
        if (![4, 8, 12].includes(numWeeks)) numWeeks = DEFAULT_WEEKS;
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(endDate.getDate() - numWeeks * 7);
      }
      // Case 3: only start
      else if (start && !end) {
        startDate = new Date(start);
        if (Number.isNaN(startDate)) return res.status(400).json({ error: 'Invalid start date' });
        endDate = new Date();
      }
      // Case 4: only end
      else if (!start && end) {
        endDate = new Date(end);
        if (Number.isNaN(endDate)) return res.status(400).json({ error: 'Invalid end date' });
        startDate = new Date();
        startDate.setDate(endDate.getDate() - MAX_WEEKS * 7);
      }
      // Case 5: both start and end
      else {
        startDate = new Date(start);
        endDate = new Date(end);
        if (Number.isNaN(startDate) || Number.isNaN(endDate))
          return res.status(400).json({ error: 'Invalid date format' });
      }

      if (startDate >= endDate)
        return res.status(400).json({ error: 'Start date must be before end date' });

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const rangeDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
      if (rangeDays > MAX_WEEKS * 7) {
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - MAX_WEEKS * 7);
      }

      numWeeks = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 7));

      // Aggregate trends grouped by week start date (Monday)
      const trends = await Issues.aggregate([
        {
          $match: {
            $or: [
              { dateReported: { $gte: startDate, $lte: endDate } },
              { dateResolved: { $gte: startDate, $lte: endDate } },
            ],
          },
        },
        {
          $project: {
            weekStartReported: {
              $dateTrunc: {
                date: '$dateReported',
                unit: 'week',
                binSize: 1,
                timezone: TIME_ZONE,
              },
            },
            weekStartResolved: {
              $dateTrunc: {
                date: '$dateResolved',
                unit: 'week',
                binSize: 1,
                timezone: TIME_ZONE,
              },
            },
          },
        },
        {
          $facet: {
            created: [
              { $match: { weekStartReported: { $ne: null } } },
              {
                $group: {
                  _id: '$weekStartReported',
                  created: { $sum: 1 },
                },
              },
            ],
            resolved: [
              { $match: { weekStartResolved: { $ne: null } } },
              {
                $group: {
                  _id: '$weekStartResolved',
                  resolved: { $sum: 1 },
                },
              },
            ],
          },
        },
        {
          $project: {
            merged: {
              $setUnion: ['$created', '$resolved'],
            },
          },
        },
        { $unwind: '$merged' },
        {
          $replaceRoot: { newRoot: '$merged' },
        },
        {
          $group: {
            _id: '$_id',
            created: { $sum: '$created' },
            resolved: { $sum: '$resolved' },
          },
        },
        {
          $project: {
            _id: 0,
            week: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$_id',
                timezone: TIME_ZONE,
              },
            },
            created: 1,
            resolved: 1,
          },
        },
        { $sort: { week: 1 } },
        { $limit: numWeeks },
      ]);

      res.status(200).json({
        success: true,
        data: trends,
        meta: { startDate, endDate, weeks: numWeeks },
      });
    } catch (err) {
      console.error('Error fetching issue trends:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  };

  /**
   * /api/issues/summary
   * Returns aggregated metrics for KPI tiles.
   */
  const getIssueSummary = async (req, res) => {
    try {
      const { start, end, weeks } = req.query;

      let startDate;
      let endDate;

      if (!start && !end && weeks) {
        const numWeeks = parseInt(weeks, 10);
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(
          endDate.getDate() - (Number.isNaN(numWeeks) ? DEFAULT_WEEKS : numWeeks) * 7,
        );
      } else if (start && end) {
        startDate = new Date(start);
        endDate = new Date(end);
      } else {
        return res
          .status(400)
          .json({ error: 'Missing required query parameters: start/end or weeks' });
      }

      if (Number.isNaN(startDate) || Number.isNaN(endDate))
        return res.status(400).json({ error: 'Invalid date format' });

      const weeksRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 7));
      if (weeksRange > MAX_WEEKS)
        return res.status(400).json({ error: `Date range cannot exceed ${MAX_WEEKS} weeks.` });

      const totalIssues = await Issues.countDocuments({
        $or: [
          { dateReported: { $gte: startDate, $lte: endDate } },
          { dateResolved: { $gte: startDate, $lte: endDate } },
        ],
      });

      const newIssues = await Issues.countDocuments({
        dateReported: { $gte: startDate, $lte: endDate },
      });

      const resolvedIssues = await Issues.countDocuments({
        dateResolved: { $gte: startDate, $lte: endDate },
      });

      const avgResolutionAgg = await Issues.aggregate([
        { $match: { dateResolved: { $gte: startDate, $lte: endDate } } },
        {
          $project: {
            resolutionTimeDays: {
              $divide: [{ $subtract: ['$dateResolved', '$dateReported'] }, 1000 * 60 * 60 * 24],
            },
          },
        },
        {
          $group: { _id: null, averageResolutionTimeDays: { $avg: '$resolutionTimeDays' } },
        },
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalIssues,
          newIssues,
          resolvedIssues,
          averageResolutionTimeDays:
            avgResolutionAgg.length > 0
              ? Number(avgResolutionAgg[0].averageResolutionTimeDays.toFixed(2))
              : 0,
        },
      });
    } catch (err) {
      console.error('Error fetching issue summary:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  };

  return { getIssueTrends, getIssueSummary };
};

module.exports = IssueAnalyticsController;
