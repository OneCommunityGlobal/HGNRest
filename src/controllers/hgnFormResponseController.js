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
        const allSkills = [];

        // Collect frontend & backend skills (skip overall)
        ['frontend', 'backend'].forEach((section) => {
          Object.entries(user[section] || {}).forEach(([k, v]) => {
            if (k.toLowerCase() === 'overall') return;
            const num = parseFloat(v);
            if (!Number.isNaN(num)) {
              allSkills.push({ skill: k, score: num, section });
            }
          });
        });

        // Add general numeric skills
        [
          'combined_frontend_backend',
          'mern_skills',
          'leadership_skills',
          'leadership_experience',
        ].forEach((field) => {
          const val = user.general?.[field];
          const num = parseFloat(val);
          if (!Number.isNaN(num)) {
            allSkills.push({ skill: field, score: num, section: 'general' });
          }
        });

        // Average score across all collected skills
        const avgScore = allSkills.length
          ? allSkills.reduce((a, b) => a + b.score, 0) / allSkills.length
          : 0;

        // Decide which section to use for topSkills
        let sectionToUse = null;
        if (skills) {
          const skillList = skills.split(',').map((s) => s.trim().toLowerCase());
          const match = allSkills.find((s) => skillList.includes(s.skill.toLowerCase()));
          if (match) sectionToUse = match.section;
        }

        // Pick top 4 from chosen section, or global top 4
        const topSkills = allSkills
          .filter((s) => (sectionToUse ? s.section === sectionToUse : true))
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map((s) => s.skill);

        return {
          _id: user._id,
          name: user.userInfo?.name,
          email: user.userInfo?.email,
          slack: user.userInfo?.slack,
          score: Number(avgScore.toFixed(1)),
          topSkills,
          preferences: user.general?.preferences || [],
        };
      });

      let filteredUsers = scoredUsers;

      // Filter by preferences
      if (preferences) {
        const prefList = preferences.split(',').map((p) => p.trim().toLowerCase());
        filteredUsers = filteredUsers.filter((u) =>
          u.preferences.some((p) => prefList.includes(p.toLowerCase())),
        );
      }

      // Filter by skills (keep users who actually have the requested skill)
      if (skills) {
        const skillList = skills.split(',').map((s) => s.trim().toLowerCase());
        filteredUsers = filteredUsers.filter((user) =>
          user.topSkills.some((skill) => skillList.includes(skill.toLowerCase())),
        );
      }

      // Sort by avg score
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
