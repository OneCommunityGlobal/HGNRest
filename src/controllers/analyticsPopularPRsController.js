const PullRequest = require('../models/pullRequest');
const PullRequestReview = require('../models/pullRequestReview');

const { parseDurationValue } = require('../helpers/analyticsPopularPRsControllerHelper');

module.exports = () => ({
  getPopularPRs: async (req, res) => {
    let startDate;
    let endDate;

    try {
      const { duration = 'allTime' } = req.query;
      const validParameters = ['lastWeek', 'last2weeks', 'lastMonth', 'allTime'];
      if (duration !== null && !validParameters.includes(duration)) {
        return res.status(400).json({
          error:
            'Invalid duration parameter. Parameter only takes values lastWeek, last2weeks, lastMonth, allTime or null.',
        });
      }
      [startDate, endDate] = parseDurationValue(duration);
    } catch (error) {
      return res
        .status(500)
        .json({ error: 'Internal Server Error: Error parsing duration parameter.' });
    }

    // console.log (startDate, endDate);
    try {
      // Step 1: Get top reviewed PRs with details
      const topReviewedWithPRs = await PullRequestReview.aggregate([
        { $match: { submittedAt: { $gte: startDate, $lt: endDate } } },
        { $group: { _id: '$prNumber', reviewCount: { $sum: 1 } } },
        { $sort: { reviewCount: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'pullrequests', // actual collection name
            localField: '_id',
            foreignField: 'prNumber',
            as: 'prDetails',
          },
        },
        { $unwind: '$prDetails' },
        {
          $project: {
            _id: 0,
            prNumber: '$_id',
            prTitle: '$prDetails.prTitle',
            reviewCount: 1,
            createdAt: '$prDetails.prCreatedAt',
          },
        },
      ]);

      let prList = topReviewedWithPRs;
      // console.log (prList);

      // Step 2: Fill with extra PRs if fewer than 20
      if (prList.length < 20) {
        const remainingNeeded = 20 - prList.length;
        const topReviewedNumbers = new Set(prList.map((p) => p.prNumber));

        const extraPRs = await PullRequest.find({
          prCreatedAt: { $lt: endDate },
          prNumber: { $nin: Array.from(topReviewedNumbers) },
        })
          .sort({ prCreatedAt: -1 })
          .limit(remainingNeeded)
          .lean();

        prList = [
          ...prList,
          ...extraPRs.map((pr) => ({
            prNumber: pr.prNumber,
            prTitle: pr.prTitle,
            reviewCount: 0,
            createdAt: pr.prCreatedAt,
          })),
        ];
      }

      res.json(prList);
    } catch (err) {
      console.error('Error fetching top PRs:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
});
