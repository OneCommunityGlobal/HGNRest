const { hasPermission } = require('../utilities/permissions');
const FormResponse = require('../models/hgnFormResponse');
const userProfile = require('../models/userProfile');

const questionnaireAnalyticsController = function () {
  const getUsersBySkills = async function (req, res) {
    try {
      const { skills, requestor } = req.body;
      const { frontend, backend } = skills || {};

      if (!skills || (!frontend?.length && !backend?.length)) {
        return res.status(400).json({ error: `Please provide 1 or more skills` });
      }

      const skillPaths = Object.entries(skills).flatMap(([domain, list]) =>
        list.map((skill) => `$${domain}.${skill}`)
      );

      const profile = await userProfile.findById(requestor.requestorId).lean();
      if (!profile) {
        return res.status(404).json({ error: 'Requestor profile not found' });
      }

      const isSameTeamParam = req.query.isSameTeam;

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
        {
          $addFields: {
            isSameTeam: {
              $cond: {
                if: {
                  $and: [
                    { $isArray: '$profile.teams' },
                    { $gt: [{ $size: '$profile.teams' }, 0] },
                  ],
                },
                then: {
                  $gt: [
                    {
                      $size: {
                        $setIntersection: ['$profile.teams', profile.teams],
                      },
                    },
                    0,
                  ],
                },
                else: false,
              },
            },
          },
        },
      ];

      if (isSameTeamParam === 'true') {
        if (profile.teams?.length > 0) {
          basePipeline.push({ $match: { isSameTeam: true } });
        } else {
          return res.status(400).json({ error: 'User is not part of any team' });
        }
      } else if (isSameTeamParam === 'false') {
        if (profile.teams?.length > 0) {
          basePipeline.push({ $match: { isSameTeam: false } });
        } else {
          return res.status(400).json({ error: 'User is not part of any team' });
        }
      }

      // Calculate score
      const addFieldsStage = { $addFields: {} };
      skillPaths.forEach((path, index) => {
        addFieldsStage.$addFields[`skill${index}`] = { $toDouble: path };
      });
      const sumFields = skillPaths.map((_, index) => `$skill${index}`);

      basePipeline.push(
        addFieldsStage,
        {
          $addFields: {
            selectedSkillsSum: { $add: sumFields },
            count: sumFields.length,
            avg_score: {
              $cond: {
                if: { $gt: [sumFields.length, 0] },
                then: { $divide: [{ $add: sumFields }, sumFields.length] },
                else: 0,
              },
            },
          },
        },
        { $sort: { avg_score: -1 } },
        {
          $project: {
            userInfo: '$userInfo.name',
            email: '$userInfo.name',
            slack: '$userInfo.slack',
            avg_score: 1,
            isSameTeam: 1,
          },
        }
      );

      const users = await FormResponse.aggregate(basePipeline);
      res.json(users);
    } catch (err) {
      console.error('Error in getUsersBySkills:', err);
      res.status(500).json({ error: `Failed to fetch details: ${err.message}` });
    }
  };

  return {
    getUsersBySkills,
  };
};

module.exports = questionnaireAnalyticsController;

