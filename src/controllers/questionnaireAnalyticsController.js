const { hasPermission } = require('utilities/permissions');
const FormResponse = require('../models/hgnFormResponse');
const userProfile = require('../models/userProfile');
// const { getSkillsList } = require('../utilities/hgnformQuestions');

const questionnaireAnalyticsController = function () {
  const getUsersBySkills = async function (req, res) {
    try {
      const { skills, requestor } = req.body;
      // payload check
      if (!skills) {
        res.status(400).json({ error: `Please provide 1 or more skills` });
      }
      // permission check
      // if (!(await hasPermission(requestor, 'seeQuestioneerAnalytics'))) {
      //   res.status(403).json({ error: `you are not authorized to view skill rankings` });
      // }

      // sample skills payload
      //   {
      //     "skills": {
      //         "frontend": ["React", "Redux"],
      //         "backend": ["MongoDB", "Deployment"]
      //     }
      //  }
      // ['$frontend.React', '$frontend.Redux', '$backend.MongoDB', '$backend.Deployment'];

      // const allSkillListPath = getSkillsList().map((skill) => {
      //   const { title, subject } = skill;
      //   return [
      //     {
      //       name: subject,
      //       score: `$${title}.${subject}`,
      //     },
      //   ];
      // });

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
        {
          $unwind: {
            path: '$profile.teams',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            isSameTeam: { $in: ['$profile.teams', profile.teams] },
          },
        },
      ];
      // filter through the same team users, if sameTeam is selected
      if (isSameTeam) {
        if (profile.teams?.length > 0) {
          basePipeline.push({
            $match: {
              isSameTeam: true,
            },
          });
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
            isSameTeam: 1,
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
            isSameTeam: 1,
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
