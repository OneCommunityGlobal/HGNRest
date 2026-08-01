const mongoose = require('mongoose');
const ToolReplacement = require('../models/toolReplacement');

const getSingleQueryValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' ? value.trim() : null;
};

const parseDate = (value) => {
  const dateValue = getSingleQueryValue(value);
  if (!dateValue) return null;

  const parsedDate = new Date(dateValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const parseToolNames = (value) => {
  const toolsValue = getSingleQueryValue(value);
  if (!toolsValue) return [];

  return toolsValue
    .split(',')
    .map((toolName) => toolName.trim())
    .filter(Boolean);
};

const formatToolReplacement = (doc) => {
  const project = doc.projectId;
  const projectId = project && project._id ? project._id : project;
  const projectName = project && typeof project === 'object' ? project.name || null : null;

  return {
    _id: doc._id,
    toolName: doc.toolName,
    requirementSatisfiedPercentage: doc.requirementSatisfiedPercentage,
    projectId,
    projectName,
    date: doc.date,
  };
};

const toolReplacementController = function () {
  const getToolReplacement = async (req, res) => {
    try {
      // Coerce query params to strings so objects/operators cannot be injected
      const startDateParam = getSingleQueryValue(req.query.startDate);
      const endDateParam = getSingleQueryValue(req.query.endDate);
      const toolsParam = getSingleQueryValue(req.query.tools);
      const projectIdParam = getSingleQueryValue(req.query.projectId);

      const startDate = startDateParam ? parseDate(startDateParam) : null;
      const endDate = endDateParam ? parseDate(endDateParam) : null;

      if (startDateParam && !startDate) {
        return res.status(400).json({ error: 'Invalid startDate' });
      }
      if (endDateParam && !endDate) {
        return res.status(400).json({ error: 'Invalid endDate' });
      }
      if (startDate && endDate && startDate > endDate) {
        return res
          .status(400)
          .json({ error: 'Invalid date range: startDate must be before endDate' });
      }

      if (projectIdParam && !mongoose.Types.ObjectId.isValid(projectIdParam)) {
        return res.status(400).json({ error: 'Invalid projectId format' });
      }

      // Build query via chained where() so user input is never passed as a raw filter object
      // (avoids Sonar NoSQL injection: constructing DB queries from user-controlled data)
      let dbQuery = ToolReplacement.find().setOptions({ sanitizeFilter: true });

      if (startDate && endDate) {
        dbQuery = dbQuery.where('date').gte(startDate).lte(endDate);
      } else if (startDate) {
        dbQuery = dbQuery.where('date').gte(startDate);
      } else if (endDate) {
        dbQuery = dbQuery.where('date').lte(endDate);
      }

      const toolNames = parseToolNames(toolsParam);
      if (toolNames.length > 0) {
        dbQuery = dbQuery.where('toolName').in(toolNames);
      }

      if (projectIdParam) {
        dbQuery = dbQuery.where('projectId').equals(new mongoose.Types.ObjectId(projectIdParam));
      }

      // Ascending by % requirement satisfied so tools most in need appear first
      const results = await dbQuery
        .populate('projectId', 'name')
        .sort({
          requirementSatisfiedPercentage: 1,
          toolName: 1,
        })
        .lean();

      return res.status(200).json(results.map(formatToolReplacement));
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
