const FormResponse = require('../models/hgnFormResponse');

const communityMemberController = function () {
  const getCommunityMembers = async function (req, res) {
    try {
      const query = {};
      const { search, skills, sortOrder = 'asc' } = req.query;

      if (search) {
        query['userInfo.name'] = { $regex: search, $options: 'i' };
      }

      // Use .lean() to get plain JS objects so Object.entries() works correctly on subdocuments
      const formResponses = await FormResponse.find(query)
        .lean()
        .sort({ 'userInfo.name': sortOrder === 'asc' ? 1 : -1 });

      const skillFilters = skills ? skills.split(',').map((s) => s.trim().toLowerCase()) : [];

      // Extract skill keys that have a numeric rating value, excluding 'overall' and internal fields
      const extractSkills = (section) => {
        if (!section || typeof section !== 'object') return {};
        return Object.entries(section).reduce((acc, [key, val]) => {
          if (key.toLowerCase() === 'overall' || key.startsWith('$') || key.startsWith('_')) {
            return acc;
          }
          const num = parseFloat(val);
          if (!Number.isNaN(num)) {
            acc[key] = num;
          }
          return acc;
        }, {});
      };

      const structuredMembers = formResponses.map((member) => {
        const { userInfo, frontend, backend, general } = member;

        return {
          _id: member._id,
          name: userInfo?.name || 'N/A',
          email: userInfo?.email || 'N/A',
          slack: userInfo?.slack || '',
          team: general?.location || 'N/A',
          skills: {
            frontend: extractSkills(frontend),
            backend: extractSkills(backend),
          },
        };
      });

      const filteredMembers =
        skillFilters.length > 0
          ? structuredMembers.filter((member) => {
              const allSkillKeys = [
                ...Object.keys(member.skills.frontend),
                ...Object.keys(member.skills.backend),
              ].map((s) => s.toLowerCase());
              return skillFilters.every((filterSkill) => allSkillKeys.includes(filterSkill));
            })
          : structuredMembers;

      res.json(filteredMembers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };

  return {
    getCommunityMembers,
  };
};

module.exports = communityMemberController;
