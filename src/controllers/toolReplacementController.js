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

const parseDateRange = (startDateParam, endDateParam) => {
  const startDate = startDateParam ? parseDate(startDateParam) : null;
  const endDate = endDateParam ? parseDate(endDateParam) : null;

  if (startDateParam && !startDate) return { error: 'Invalid startDate' };
  if (endDateParam && !endDate) return { error: 'Invalid endDate' };
  if (startDate && endDate && startDate > endDate) {
    return { error: 'Invalid date range: startDate must be before endDate' };
  }

  return { startDate, endDate };
};

// Query params are coerced to strings so objects/operators cannot be injected
const parseFilters = (query) => {
  const dateRange = parseDateRange(
    getSingleQueryValue(query.startDate),
    getSingleQueryValue(query.endDate),
  );
  if (dateRange.error) return { error: dateRange.error };

  const projectIdParam = getSingleQueryValue(query.projectId);
  if (projectIdParam && !mongoose.Types.ObjectId.isValid(projectIdParam)) {
    return { error: 'Invalid projectId format' };
  }

  return {
    filters: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      toolNames: parseToolNames(getSingleQueryValue(query.tools)),
      projectId: projectIdParam,
    },
  };
};

// Chained where() keeps user input out of raw filter objects
// (avoids Sonar NoSQL injection: constructing DB queries from user-controlled data)
const buildToolReplacementQuery = ({ startDate, endDate, toolNames, projectId }) => {
  let dbQuery = ToolReplacement.find().setOptions({ sanitizeFilter: true });

  if (startDate) dbQuery = dbQuery.where('date').gte(startDate);
  if (endDate) dbQuery = dbQuery.where('date').lte(endDate);
  if (toolNames.length > 0) dbQuery = dbQuery.where('toolName').in(toolNames);
  if (projectId) {
    dbQuery = dbQuery.where('projectId').equals(new mongoose.Types.ObjectId(projectId));
  }

  return dbQuery;
};

const formatToolReplacement = (doc) => {
  const project = doc.projectId;
  const isPopulated = project && typeof project === 'object' && project._id;

  return {
    _id: doc._id,
    toolName: doc.toolName,
    requirementSatisfiedPercentage: doc.requirementSatisfiedPercentage,
    projectId: isPopulated ? project._id : project,
    projectName: isPopulated ? project.name || null : null,
    date: doc.date,
  };
};

const toolReplacementController = function () {
  const getToolReplacement = async (req, res) => {
    try {
      const { error, filters } = parseFilters(req.query);
      if (error) return res.status(400).json({ error });

      // Ascending by % requirement satisfied so tools most in need appear first
      const results = await buildToolReplacementQuery(filters)
        .populate('projectId', 'name')
        .sort({
          requirementSatisfiedPercentage: 1,
          toolName: 1,
        })
        .lean();

      return res.status(200).json(results.map(formatToolReplacement));
    } catch (err) {
      console.error('Error fetching tool replacement data: ', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  return {
    getToolReplacement,
  };
};

module.exports = toolReplacementController;
