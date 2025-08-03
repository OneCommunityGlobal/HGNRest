const mongoose = require('mongoose');

const userSkillTabsController = (HgnFormResponses) => {
  const parseScore = (val) => parseInt(val || '0');

  const skillMap = {
    frontend: {
      "UI/UX Design": ["frontend", "UIUXTools"],
      "Bootstrap": ["frontend", "Bootstrap"],
      "Advanced React": ["frontend", "React"],
      "Overall Frontend": ["frontend", "overall"],
      "Web Sockets Integration": ["frontend", "WebSocketCom"],
      "Responsive Design": ["frontend", "ResponsiveUI"],
      "HTML Semantics": ["frontend", "HTML"],
      "Advanced CSS Techniques": ["frontend", "CSS"],
      "Advanced Redux": ["frontend", "Redux"],
    },
    backend: {
      "Advanced JavaScript Backend": ["backend", "overall"],
      "MERN Stack": ["general", "mern_skills"],
      "Test-Driven Development": ["backend", "TestDrivenDev"],
      "Database Setup": ["backend", "Database"],
      "Overall Backend": ["backend", "overall"],
      "Unit Testing": ["frontend", "UnitTest"],
      "MongoDB": ["backend", "MongoDB"],
      "Mock MongoDB Integration": ["backend", "MongoDB"],
    },
    devops: {
      "Deployment": ["backend", "Deployment"],
      "Version Control": ["backend", "VersionControl"],
      "Environment Setup": ["backend", "EnvironmentSetup"],
    },
    softwarePractices: {
      "Code review skills": ["backend", "CodeReview"],
      "Agile Development": ["backend", "AgileDevelopment"],
      "Docs and Markdown": ["frontend", "Documentation"],
      "Leadership/Management Experience": ["general", "leadership_experience"],
      "Leadership/Management Skills": ["general", "leadership_skills"],
      "Advanced Coding Skills": ["backend", "AdvancedCoding"],
    }
  };

  const buildResponse = (data, fields) => Object.entries(fields).map(([label, [section, key]]) => ({
      label,
      score: parseScore(data?.[section]?.[key])
    }));

  const dashboard = async (req, res) => {
    try {
      const response = await HgnFormResponses.findOne({ user_id: req.params.userId }).lean();
      if (!response) return res.status(404).json({ error: 'User data not found' });

      const allFields = {
        ...skillMap.frontend,
        ...skillMap.backend,
        ...skillMap.devops,
        ...skillMap.softwarePractices
      };
      const allSkills = buildResponse(response, allFields);

      res.json({ allSkills });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    dashboard,
    frontend: async (req, res) => {
      const data = await HgnFormResponses.findOne({ user_id: req.params.userId }).lean();
      if (!data) return res.status(404).json({ error: 'User not found' });
      res.json({ frontend: buildResponse(data, skillMap.frontend) });
    },
    backend: async (req, res) => {
      const data = await HgnFormResponses.findOne({ user_id: req.params.userId }).lean();
      if (!data) return res.status(404).json({ error: 'User not found' });
      res.json({ backend: buildResponse(data, skillMap.backend) });
    },
    devops: async (req, res) => {
      const data = await HgnFormResponses.findOne({ user_id: req.params.userId }).lean();
      if (!data) return res.status(404).json({ error: 'User not found' });
      res.json({ devops: buildResponse(data, skillMap.devops) });
    },
    softwarePractices: async (req, res) => {
      const data = await HgnFormResponses.findOne({ user_id: req.params.userId }).lean();
      if (!data) return res.status(404).json({ error: 'User not found' });
      res.json({ softwarePractices: buildResponse(data, skillMap.softwarePractices) });
    }
  };
};

module.exports = userSkillTabsController;
