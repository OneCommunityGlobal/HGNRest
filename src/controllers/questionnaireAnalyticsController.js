// const { hasPermission } = require('../utilities/permissions');
const FormResponse = require('../models/hgnFormResponse');

const questionnaireAnalyticsController = function () {
  const getUsersBySkills = async function (req, res) {
    try {
      const { skills } = req.body;
      const { frontend, backend } = skills || {};

      if (!skills || (!frontend?.length && !backend?.length)) {
        return res.status(400).json({ error: `Please provide 1 or more skills` });
      }

      const skillPaths = Object.entries(skills).flatMap(([domain, list]) =>
        list.map((skill) => `$${domain}.${skill}`),
      );

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
                if: { $isArray: '$profile.teams' },
                then: { $gt: [{ $size: '$profile.teams' }, 0] },
                else: false,
              },
            },
          },
        },
      ];

      if (isSameTeamParam === 'true') {
        basePipeline.push({ $match: { isSameTeam: true } });
      } else if (isSameTeamParam === 'false') {
        basePipeline.push({ $match: { isSameTeam: false } });
      }

      // Calculate score
      const addFieldsStage = { $addFields: {} };
      skillPaths.forEach((path, index) => {
        addFieldsStage.$addFields[`skill${index}`] = {
          $convert: {
            input: { $ifNull: [path, '0'] },
            to: 'double',
            onError: 0,
            onNull: 0,
          },
        };
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
            _id: 0,
            userId: '$profile._id',
            firstName: '$profile.firstName',
            lastName: '$profile.lastName',
            userEmail: '$userInfo.email',
            phoneNumber: '$profile.phoneNumber',
            slack: '$userInfo.slack',
            github: '$userInfo.github',
            avg_score: 1,
            isSameTeam: 1,
            frontend: 1,
            backend: 1,
            privacySettings: '$profile.privacySettings',
          },
        },
      );

      const users = await FormResponse.aggregate(basePipeline);

      // Calculate topSkills and build response in Node.js
      const result = users.map((user) => {
        // Build name
        const name = `${user.firstName} ${user.lastName}`;

        // Build all skills
        const allSkills = { ...user.frontend, ...user.backend };
        const skillsArray = Object.entries(allSkills)
          .map(([k, v]) => ({ k, v: parseFloat(v) || 0 }))
          .sort((a, b) => b.v - a.v);
        const topSkills = skillsArray.slice(0, 4).map((s) => s.k);

        // Privacy enforcement
        let email = null;
        let phoneNumber = null;
        if (user.privacySettings?.email === false) {
          email = user.userEmail;
        }
        if (user.privacySettings?.phoneNumber === false) {
          phoneNumber = user.phoneNumber;
        }

        return {
          userId: user.userId,
          name,
          email,
          phoneNumber,
          slack: user.slack,
          github: user.github,
          avg_score: user.avg_score,
          isSameTeam: user.isSameTeam,
          topSkills,
        };
      });

      res.json(result);
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
