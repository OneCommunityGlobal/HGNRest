const prInsightsController = function (insightsData) {
  const getPRReviewInsights = async (req, res) => {
    try {
      const { duration, teams } = req.query;

      const validDurations = ['lastWeek', 'last2weeks', 'lastMonth', 'allTime'];
      if (duration && !validDurations.includes(duration)) {
        return res.status(400).json({ error: 'Invalid duration parameter' });
      }

      const teamCodes = teams ? teams.split(',') : [];

      const query = {};
      const now = new Date();
      if (duration === 'lastWeek') {
        query.reviewDate = { $gte: new Date(now.setDate(now.getDate() - 7)) };
      } else if (duration === 'last2weeks') {
        query.reviewDate = { $gte: new Date(now.setDate(now.getDate() - 14)) };
      } else if (duration === 'lastMonth') {
        query.reviewDate = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
      }
      if (teamCodes.length > 0) {
        query.teamCode = { $in: teamCodes };
      }

      const insightsDataResult = await insightsData.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$teamCode",
            actionSummary: {
              $push: {
                actionTaken: "$actionTaken",
                count: 1
              }
            },
            qualityDistribution: {
              $push: {
                qualityLevel: "$qualityLevel",
                count: 1
              }
            }
          }
        },
        {
          $unwind: "$actionSummary"
        },
        {
          $group: {
            _id: {
              teamCode: "$_id",
              actionTaken: "$actionSummary.actionTaken"
            },
            totalCount: {
              $sum: "$actionSummary.count"
            },
            qualityDistribution: {
              $first: "$qualityDistribution"
            }
          }
        },
        {
          $group: {
            _id: "$_id.teamCode",
            actionSummary: {
              $push: {
                actionTaken: "$_id.actionTaken",
                count: "$totalCount"
              }
            },
            qualityDistribution: {
              $first: "$qualityDistribution"
            }
          }
        },
        {
          $unwind: "$qualityDistribution"
        },
        {
          $group: {
            _id: {
              teamCode: "$_id",
              qualityLevel:
                "$qualityDistribution.qualityLevel"
            },
            totalCount: {
              $sum: "$qualityDistribution.count"
            },
            actionSummary: {
              $first: "$actionSummary"
            }
          }
        },
        {
          $group: {
            _id: "$_id.teamCode",
            qualityDistribution: {
              $push: {
                qualityLevel: "$_id.qualityLevel",
                count: "$totalCount"
              }
            },
            actionSummary: {
              $first: "$actionSummary"
            }
          }
        }
      ]);

      return res.status(200).json({ teams: insightsDataResult });
    } catch (error) {
      console.error('Error fetching PR review insights:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const postPRReviewInsights = async (req, res) => {
    try {
      const { teamCode, reviewDate, actionTaken, qualityLevel } = req.body;

      if (!teamCode || !reviewDate || !actionTaken || !qualityLevel) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const validActions = ['Approved', 'Changes Requested', 'Commented'];
      const validQualityLevels = ['Not approved', 'Low Quality', 'Sufficient', 'Exceptional'];

      if (!validActions.includes(actionTaken)) {
        return res.status(400).json({ error: 'Invalid actionTaken value' });
      }

      if (!validQualityLevels.includes(qualityLevel)) {
        return res.status(400).json({ error: 'Invalid qualityLevel value' });
      }

      // eslint-disable-next-line new-cap
      const newInsight = new insightsData({
        teamCode,
        reviewDate: new Date(reviewDate),
        actionTaken,
        qualityLevel,
      });

      await newInsight.save();

      return res.status(201).json({ message: 'PR review insight saved successfully', data: newInsight });
    } catch (error) {
      console.error('Error saving PR review insight:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    getPRReviewInsights,
    postPRReviewInsights,
  };
};

module.exports = prInsightsController;