const mongoose = require('mongoose');
const ToolReplacement = require('../models/toolReplacement');

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const toolReplacementController = function () {
  const getToolReplacement = async (req, res) => {
    try {
      const { startDate, endDate, tools, projectId } = req.query;
      const query = {};

      if (startDate || endDate) {
        if (startDate && !isValidDate(startDate)) {
          return res.status(400).json({ error: 'Invalid startDate' });
        }
        if (endDate && !isValidDate(endDate)) {
          return res.status(400).json({ error: 'Invalid endDate' });
        }
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
          return res
            .status(400)
            .json({ error: 'Invalid date range: startDate must be before endDate' });
        }

        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      if (tools && tools.length > 0) {
        query.toolName = {
          $in: tools
            .split(',')
            .map((tool) => tool.trim())
            .filter(Boolean),
        };
      }

      if (projectId) {
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
          return res.status(400).json({ error: 'Invalid projectId format' });
        }
        query.projectId = projectId;
      }

      // Ascending by % requirement satisfied so tools most in need appear first
      const results = await ToolReplacement.find(query).sort({
        requirementSatisfiedPercentage: 1,
        toolName: 1,
      });

      return res.status(200).json(results);
    } catch (error) {
      console.error('Error fetching tool replacement data: ', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  return {
    getToolReplacement,
  };
};

module.exports = toolReplacementController;
