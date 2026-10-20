/* eslint-disable prefer-template */
/* eslint-disable prefer-const */
/* eslint-disable no-restricted-globals */
/* eslint-disable radix */
/* eslint-disable camelcase */
const FormResponse = require('../models/hgnFormResponse');
const { hasPermission } = require('../utilities/permissions');

// How many skills a member card shows, and how deep the skills filter looks.
const TOP_SKILLS_COUNT = 4;

const hgnFormController = () => {
  const submitFormResponse = async (req, res) => {
    const { userInfo, general, frontend, backend, followUp, user_id } = req.body;
    if (!userInfo || !general || !frontend || !backend || !followUp || !user_id) {
      return res.status(400).json({
        error: 'All fields (userInfo, general, frontend, backend, followUp, user_id) are required',
      });
    }

    try {
      const formResponse = new FormResponse(req.body);
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

      // FIX ISSUE #8: Manually fetch user profiles to get isActive
      const UserProfile = require('../models/userProfile');
      const userIds = responses.map((r) => r.user_id).filter(Boolean);
      const users = await UserProfile.find(
        { _id: { $in: userIds } },
        'isActive firstName lastName',
      );

      // Create a map for quick lookup
      const userMap = {};
      const profileNameMap = {};
      users.forEach((u) => {
        userMap[u._id.toString()] = u.isActive;
        profileNameMap[u._id.toString()] = [u.firstName, u.lastName].filter(Boolean).join(' ');
      });

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

        const byScore = (a, b) => b.score - a.score;
        const skillList = skills ? skills.split(',').map((s) => s.trim().toLowerCase()) : [];
        const isSelected = (s) => skillList.includes(s.skill.toLowerCase());

        // Who matches the skills filter: unchanged rule. A selected skill must be
        // among the user's top 4 in the section of their first selected skill.
        // Every form response stores a score for every skill, so matching on
        // "has the skill" alone would let 0-2/10 scores through.
        const firstMatch = allSkills.find(isSelected);
        const matchesSkills =
          !skills ||
          allSkills
            .filter((s) => (firstMatch ? s.section === firstMatch.section : true))
            .sort(byScore)
            .slice(0, TOP_SKILLS_COUNT)
            .some(isSelected);

        // What "Top Skills" displays: the selected skills first (by score), then
        // the user's other highest-scoring skills, up to 4. Display only; it no
        // longer decides who passes the filter.
        const matchedSkills = allSkills.filter(isSelected).sort(byScore);
        const remainingSkills = allSkills.filter((s) => !isSelected(s)).sort(byScore);
        const topSkills = [...matchedSkills, ...remainingSkills]
          .slice(0, TOP_SKILLS_COUNT)
          .map((s) => s.skill);

        // FIX ISSUE #8: Get isActive from userMap
        const userId = user.user_id?.toString();
        const isActive = userId && userMap[userId] !== undefined ? userMap[userId] : true;

        return {
          _id: user._id,
          userId: user.user_id,
          // Some responses were saved with an empty userInfo.name; fall back to the
          // linked profile's name so the member card is not blank.
          name: user.userInfo?.name?.trim() || profileNameMap[userId] || user.userInfo?.name,
          email: user.userInfo?.email,
          slack: user.userInfo?.slack,
          score: Number(avgScore.toFixed(1)),
          topSkills,
          preferences: user.general?.preferences || [],
          isActive,
          matchesSkills,
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

      // Filter by skills (decided per user above, independent of the display list)
      if (skills) {
        filteredUsers = filteredUsers.filter((user) => user.matchesSkills);
      }

      // Sort by avg score
      filteredUsers.sort((a, b) => b.score - a.score);

      // matchesSkills is internal; keep the response shape unchanged
      res.json(filteredUsers.map(({ matchesSkills, ...user }) => user));
    } catch (err) {
      console.error('Error in getRankedResponses:', err);
      res.status(500).json({ error: 'Failed to rank users' });
    }
  };

  return { submitFormResponse, getAllFormResponses, getRankedResponses };
};
module.exports = hgnFormController;
