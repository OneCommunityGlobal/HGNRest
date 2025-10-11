const Issues = require('../../models/bmdashboard/issueAnalytics');

const IssueAnalyticsController = function () {
  const getIssueTrends = async (req, res) => {
    try {
      const { start, end, weeks } = req.query;

      if (!start || !end || !weeks) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameters: start, end, and weeks',
        });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      const trends = await Issues.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              week: { $isoWeek: '$createdAt' },
              year: { $isoWeekYear: '$createdAt' },
            },
            created: {
              $sum: { $cond: [{ $eq: ['$status', 'Created'] }, 1, 0] },
            },
            resolved: {
              $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            week: {
              $concat: [{ $toString: '$_id.year' }, '-W', { $toString: '$_id.week' }],
            },
            created: 1,
            resolved: 1,
          },
        },
        { $sort: { week: 1 } },
        { $limit: parseInt(weeks, 10) },
      ]);

      res.status(200).json({ success: true, data: trends });
    } catch (error) {
      console.error('Error fetching issue trends:', error);
      res.status(500).json({
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error',
      });
    }
  };

  const getIssueSummary = async (req, res) => {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameters: start and end',
        });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      const totalIssues = await Issues.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
      });

      const newIssues = await Issues.countDocuments({
        status: 'Created',
        createdAt: { $gte: startDate, $lte: endDate },
      });

      const resolvedIssues = await Issues.countDocuments({
        status: 'Resolved',
        resolvedAt: { $gte: startDate, $lte: endDate },
      });

      const avgResolution = await Issues.aggregate([
        {
          $match: {
            status: 'Resolved',
            resolvedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $project: {
            resolutionTimeDays: {
              $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60 * 24],
            },
          },
        },
        {
          $group: {
            _id: null,
            averageResolutionTimeDays: { $avg: '$resolutionTimeDays' },
          },
        },
      ]);

      const summary = {
        totalIssues,
        newIssues,
        resolvedIssues,
        averageResolutionTimeDays:
          avgResolution.length > 0
            ? Number(avgResolution[0].averageResolutionTimeDays.toFixed(2))
            : 0,
      };

      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      console.error('Error fetching issue summary:', error);
      res.status(500).json({
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error',
      });
    }
  };

  return {
    getIssueTrends,
    getIssueSummary,
  };
};

module.exports = IssueAnalyticsController;
