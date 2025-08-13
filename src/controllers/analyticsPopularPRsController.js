const PullRequest = require('../models/pullRequest');
const PullRequestReview = require('../models/pullRequestReview');

function getLastSunday(today = new Date()) {
  const dayOfWeek = today.getUTCDay();
  today.setUTCDate(today.getUTCDate() - dayOfWeek);
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function getFirstDayInMonth(duration, today = new Date()) {
  today.setUTCMonth(today.getUTCMonth() - duration);
  today.setUTCDate(1);
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function parseDurationValue(duration) {
  let startDate = null;
  let endDate = null;
  switch (duration) {
    case 'lastWeek': {
      const lastSunday = getLastSunday();
      startDate = new Date(lastSunday);
      endDate = new Date(lastSunday);
      startDate.setUTCDate(startDate.getUTCDate() - 7);
      break;
    }
    case 'last2weeks': {
      const lastSunday = getLastSunday();
      startDate = new Date(lastSunday);
      endDate = new Date(lastSunday);
      startDate.setUTCDate(startDate.getUTCDate() - 14);
      break;
    }
    case 'lastMonth': {
      startDate = getFirstDayInMonth(1);
      endDate = getFirstDayInMonth(0);
      break;
    }
    default: {
      startDate = new Date('1970-01-01T00:00:00Z');
      endDate = new Date();
      break;
    }
  }

  return [startDate, endDate];
}

module.exports = () => ({
  getPopularPRs: async (req, res) => {
    let startDate;
    let endDate;

    try {
      const { duration = 'allTime' } = req.query;
      const validParameters = ['lastWeek', 'last2weeks', 'lastMonth', 'allTime'];
      if (duration !== null && !validParameters.includes(duration)) {
        return res
          .status(400)
          .json({
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

    try {
      // Step 1: Aggregate PR reviews for the duration
      const topReviewed = await PullRequestReview.aggregate([
        {
          $match: {
            submittedAt: { $gte: startDate, $lt: endDate },
          },
        },
        {
          $group: {
            _id: '$prNumber',
            reviewCount: { $sum: 1 },
          },
        },
        { $sort: { reviewCount: -1 } },
        { $limit: 20 },
      ]);
      // console.log (startDate, endDate);
      // console.log (topReviewed);

      const topPRNumbers = topReviewed.map((r) => r._id);
      // console.log (topPRNumbers);

      // Step 2: Get PullRequest details for top reviewed PRs
      const topPRDetails = await PullRequest.find({
        prNumber: { $in: topPRNumbers },
      }).lean();

      // Merge review counts into PR details
      let prList = topPRDetails
        .map((pr) => ({
          prNumber: pr.prNumber,
          prTitle: pr.prTitle,
          reviewCount: topReviewed.find((r) => r._id === pr.prNumber)?.reviewCount || 0,
          createdAt: pr.prCreatedAt,
        }))
        .sort((a, b) => b.reviewCount - a.reviewCount);

      // Step 3: If less than 20, fetch PRs in duration without reviews
      if (prList.length < 20) {
        const remainingNeeded = 20 - prList.length;

        const extraPRs = await PullRequest.find({
          prCreatedAt: { $lt: endDate },
          prNumber: { $nin: topPRNumbers },
        })
          .sort({ prCreatedAt: -1 })
          .limit(remainingNeeded)
          .lean();

        const extraList = extraPRs.map((pr) => ({
          prNumber: pr.prNumber,
          prTitle: pr.prTitle,
          reviewCount: 0,
          createdAt: pr.prCreatedAt,
        }));

        prList = [...prList, ...extraList];
      }

      // Step 4: Return the combined result
      res.json(prList);
    } catch (err) {
      console.error('Error fetching top PRs:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
});
