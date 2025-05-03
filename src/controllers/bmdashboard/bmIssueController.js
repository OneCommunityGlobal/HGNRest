const mongoose = require('mongoose');

const bmIssueController = function (BuildingIssue) {
  const bmGetIssue = async (req, res) => {
    try {
      BuildingIssue.find()
        .populate()
        .then((result) => res.status(200).send(result))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  const bmPostIssue = async (req, res) => {
    try {
      const newIssue = BuildingIssue.create(req.body)
        .then((result) => res.status(201).send(result))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  //   GET /issues/longest-open?projectIds=proj1,proj2&startDate=xxx&endDate=xxx
  const bmLongestOpenIssues = async (req, res) => {
    const today = new Date();
    try {
      const pipeline = [
        // Match only issues that are still open (no closeDate)
        { $match: { closeDate: { $exists: false } } },

        // Add calculated daysOpen field
        {
          $addFields: {
            daysOpen: {
              $divide: [
                { $subtract: [today, '$createdDate'] },
                1000 * 60 * 60 * 24, // milliseconds to days
              ],
            },
          },
        },

        // Limit to top results (you can make this configurable)
        { $limit: 5 },

        // Project only the required fields
        {
          $project: {
            _id: 0, // exclude default _id
            IssueId: '$_id', // rename _id to IssueId
            title: '$issueTitle',
            daysOpen: { $round: ['$daysOpen', 0] }, // round to whole number
          },
        },
        { $sort: { totalCost: -1 } },
      ];

      const longestOpenIssues = await BuildingIssue.aggregate(pipeline);

      res.status(200).json({
        success: true,
        count: longestOpenIssues.length,
        data: longestOpenIssues,
      });
    } catch (error) {
      console.error('Error fetching longest open issues:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching longest open issues',
      });
    }
  };

  return { bmGetIssue, bmPostIssue, bmLongestOpenIssues, bmMostExpensiveIssues };
};

  const bmMostExpensiveIssues = async (req, res) => {
    const today = new Date();
    try {
      const pipeline = [
        // Match only issues that are still open (no closeDate)
        { $match: { closeDate: { $exists: false } } },

        // Add calculated daysOpen field
        {
          $addFields: {
            daysOpen: {
              $divide: [
                { $subtract: [today, '$createdDate'] },
                1000 * 60 * 60 * 24, // milliseconds to days
              ],
            },
          },
        },

        // Limit to top results (you can make this configurable)
        { $limit: 5 },

        // Project only the required fields
        {
          $project: {
            _id: 0, // exclude default _id
            IssueId: '$_id', // rename _id to IssueId
            title: '$issueTitle',
            totalCost: { $ifNull: ['$totalCost', null] }, // include if exists
            daysOpen: { $round: ['$daysOpen', 0] }, // round to whole number
          },
        },
        { $sort: { totalCost: -1 } },
      ];

      const mostExpensiveIssues = await BuildingIssue.aggregate(pipeline);

      res.status(200).json({
        success: true,
        count: mostExpensiveIssues.length,
        data: mostExpensiveIssues,
      });
    } catch (error) {
      console.error('Error fetching longest open issues:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching longest open issues',
      });
    }
  };

  return { bmGetIssue, bmPostIssue, bmLongestOpenIssues, bmMostExpensiveIssues };
};

module.exports = bmIssueController;
