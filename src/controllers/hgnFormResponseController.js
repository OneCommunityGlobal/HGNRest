/* eslint-disable camelcase */
const FormResponse = require('../models/hgnFormResponse');
const { hasPermission } = require('../utilities/permissions');

const hgnFormController = () => {
  const submitFormResponse = async (req, res) => {
    const { userInfo, general, frontend, backend, followUp, user_id } = req.body;
    if (!userInfo || !general || !frontend || !backend || !followUp || !user_id) {
      return res.status(400).json({
        error: 'All fields (userInfo, general, frontend, backend, followUp, user_id) are required',
      });
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
      res.status(500).json({ error: `Failed to create formResponse: ${err.message}` });
    }
  };

  const getAllFormResponses = async (req, res) => {
    try {
      if (!(await hasPermission(req.body.requestor, 'accessHgnSkillsDashboard'))) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const formResponses = await FormResponse.find();
      res.json(formResponses);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const getRankedResponses = async (req, res) => {
    try {
      const { preferences, skills } = req.query;
      const responses = await FormResponse.find();

      const scoredUsers = responses.map((user) => {
        const topSkills = [];
        const allScores = [];

        // Collect scores from frontend & backend, ignore 'overall'
        ['frontend', 'backend'].forEach((section) => {
          Object.entries(user[section] || {}).forEach(([k, v]) => {
            if (k.toLowerCase() === 'overall') return;
            const num = parseFloat(v);
            if (!Number.isNaN(num)) {
              topSkills.push({ skill: k, score: num });
              allScores.push(num);
            }
          });
        });

        // Include general numeric fields
        [
          'combined_frontend_backend',
          'mern_skills',
          'leadership_skills',
          'leadership_experience',
        ].forEach((field) => {
          const val = user.general?.[field];
          const num = parseFloat(val);
          if (!Number.isNaN(num)) allScores.push(num);
        });

        const avgScore = allScores.length
          ? allScores.reduce((a, b) => a + b, 0) / allScores.length
          : 0;

        // Sort topSkills descending
        topSkills.sort((a, b) => b.score - a.score);

        return {
          _id: user._id,
          name: user.userInfo?.name,
          email: user.userInfo?.email,
          slack: user.userInfo?.slack,
          score: Number(avgScore.toFixed(1)),
          topSkills: topSkills.slice(0, 4).map((s) => s.skill),
          preferences: user.general?.preferences || [],
        };
      });

      let filteredUsers = scoredUsers;

      // Filter by preferences
      if (preferences) {
        const prefList = preferences.split(',').map((p) => p.trim());
        filteredUsers = filteredUsers.filter((u) =>
          u.preferences.some((p) => prefList.includes(p)),
        );
      }

      // Filter by skills (only keep users who have numeric score for at least one skill)
      if (skills) {
        const skillList = skills.split(',').map((s) => s.trim());
        filteredUsers = filteredUsers.filter((user) => {
          const userSkillSet = new Set([...user.topSkills]);
          return skillList.some((skill) => userSkillSet.has(skill));
        });
      }

      // Sort descending by score
      filteredUsers.sort((a, b) => b.score - a.score);

      res.json(filteredUsers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to rank users' });
    }
  };

  return { submitFormResponse, getAllFormResponses, getRankedResponses };
};

module.exports = hgnFormController;
