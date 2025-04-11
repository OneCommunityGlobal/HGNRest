const mongoose = require('mongoose');
const FormResponse = require('../models/hgnFormResponse');

const communityMemberController = function () {
  const getCommunityMembers = async function (req, res) {
    console.log("Community members endpoint hit!");
    try {
      const query = {};
      const { search,skills, sortOrder = 'asc' } = req.query;
      
    
      if (search) {
        query['userInfo.name'] = { $regex: search, $options: 'i' };
      }
      const formResponses = await FormResponse.find(query)
      .sort({ 'userInfo.name': sortOrder === 'asc' ? 1 : -1 });
  
      const skillFilters = skills ? skills.split(',').map(s => s.trim().toLowerCase()) : [];
      const structuredMembers = formResponses.map(member => {
        const { userInfo, frontend, backend, general } = member;

        const extractSkills = (section) => {
          return Object.entries(section || {}).reduce((acc, [key, val]) => {
            const num = parseFloat(val);
            if (key.toLowerCase() !== 'overall' && !isNaN(num)) {
              acc[key] = num;
            }
            return acc;
          }, {});
        };

        return {
          _id: member._id,
          name: userInfo?.name || "N/A",
          email: userInfo?.email || "N/A",
          slack: userInfo?.slack || "",
          team: general?.location || "N/A",
          skills: {
            frontend: extractSkills(frontend),
            backend: extractSkills(backend),
          }
        };
      });

      const filteredMembers = skillFilters.length > 0
      ? structuredMembers.filter(member => {
          const allSkills = {
            ...member.skills.frontend,
            ...member.skills.backend
          };
          const lowercased = Object.keys(allSkills).map(s => s.toLowerCase());
          return skillFilters.every(filterSkill => lowercased.includes(filterSkill));
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


