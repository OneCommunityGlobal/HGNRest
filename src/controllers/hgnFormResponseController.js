/* eslint-disable camelcase */
const FormResponse = require('../models/hgnFormResponse');

const hgnFormController = function () {
  const submitFormResponse = async function (req, res) {
    const { userInfo, general, frontend, backend, followUp, user_id } = req.body;
    if (!userInfo || !general || !frontend || !backend || !followUp || !user_id) {
      return res
        .status(400)
        .json({ error: 'All fields (userInfo, general, frontend, backend) are required' });
    }
    try {
      const formResponse = new FormResponse({
        userInfo,
        general,
        frontend,
        backend,
        followUp,
        user_id,
      });
      await formResponse.save();
      res.status(201).json(formResponse);
    } catch (err) {
      res.status(500).json({ error: `Failed to create formResponse: ${  err.message}` });
    }
  };

  const getAllFormResponses = async function (req, res) {
    try {
      const formResponses = await FormResponse.find();
      res.json(formResponses);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  const getRankedResponses = async function (req, res) {
    try {
      const { skills } = req.query;
      if (!skills) return res.status(400).json({ error: 'Missing skills query' });

      const selectedSkills = skills.split(',').map((s) => s.trim());

      // Mapping of frontend/backend skill names to schema fields
      const skillMap = {
        React: ['frontend', 'React'],
        Redux: ['frontend', 'Redux'],
        HTML: ['frontend', 'HTML'],
        CSS: ['frontend', 'CSS'],
        MongoDB: ['backend', 'MongoDB'],
        Database: ['backend', 'Database'],
        Agile: ['backend', 'AgileDevelopment'],
        // Add more as needed
      };

      const responses = await FormResponse.find();

      const scoredUsers = responses.map((user) => {
        const scoreList = [];

        selectedSkills.forEach((skill) => {
          const [section, field] = skillMap[skill] || [];
          if (section && field && user[section]?.[field]) {
            scoreList.push(parseInt(user[section][field]));
          }
        });

        const averageScore = scoreList.length
          ? scoreList.reduce((a, b) => a + b, 0) / scoreList.length
          : 0;

        // Get all skills to find top 4
        const allSkills = [];
        ['frontend', 'backend'].forEach((section) => {
          Object.entries(user[section] || {}).forEach(([key, val]) => {
            const parsed = parseInt(val);
            if (!isNaN(parsed)) {
              allSkills.push({ skill: key, score: parsed });
            }
          });
        });

        const topSkills = allSkills
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map((s) => s.skill);

        return {
          _id: user._id,
          name: user.userInfo?.name,
          email: user.userInfo?.email,
          slack: user.userInfo?.slack,
          score: Number(averageScore.toFixed(1)),
          topSkills,
          isTeammate: false, // you can replace with actual logic
          privacy: {
            email: false,
            slack: false,
          },
        };
      });

      scoredUsers.sort((a, b) => b.score - a.score);
      res.json(scoredUsers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to calculate ranked responses' });
    }
  };
  return {
    getAllFormResponses,
    submitFormResponse,
    getRankedResponses,
  };
};
module.exports = hgnFormController;
