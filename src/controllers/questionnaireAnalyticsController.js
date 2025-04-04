const FormResponse = require('../models/hgnFormResponse');
const userProfile = require('../models/userProfile');
const questionnaireAnalyticsController = function () {
  const getUsersBySkills = async function (req, res) {
    try {
      const { skills, requestor } = req.body;

      const skillPaths = Object.entries(skills).flatMap(([domain, list]) =>
        list.map((skill) => `$${domain}.${skill}`),
      );

      const profile = await userProfile.findById(requestor.requestorId).lean();

      const isSameTeam = req.query.isSameTeam === 'true';

      const basePipeline = [
        {
          $lookup: {
            from: 'userProfiles',
            localField: 'user_id',
            foreignField: '_id',
            as: 'profile',
          },
        },
        { $unwind: '$profile' },
      ];
      if (isSameTeam) {
        if (profile.teams?.length > 0) {
          basePipeline.push(
            { $unwind: '$profile.teams' },
            {
              $match: {
                'profile.teams': { $in: profile.teams },
              },
            },
          );
        } else {
          res.status(400).json({ error: `User is not part of any team` });
        }
      }

      basePipeline.push(
        {
          $project: {
            userInfo: 1,
            profile: 1,
            selectedSkillsSum: {
              $sum: skillPaths.map((path) => ({ $toDouble: path })),
            },
            count: { $literal: skillPaths.length },
          },
        },
        {
          $addFields: {
            avg_score: { $divide: ['$selectedSkillsSum', '$count'] },
          },
        },
        { $sort: { avg_score: -1 } },
        {
          $project: {
            userInfo: '$userInfo.name',
            email: '$userInfo.name',
            slack: '$userInfo.slack',
            // firstname: '$profile.firstName',
            // lastname: '$profile.lastName',
            // email: '$profile.email',
            avg_score: 1,
          },
        },
      );

      const users = await FormResponse.aggregate(basePipeline);
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: `Failed to fetch details: ${err.message}` });
    }
  };

  return {
    getUsersBySkills,
  };
};
module.exports = questionnaireAnalyticsController;
