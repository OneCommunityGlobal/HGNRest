const mongoose = require('mongoose');
const ToolReplacement = require('../models/toolReplacement');

const YMD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const getSingleQueryValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' ? value.trim() : null;
};

const isValidCalendarParts = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

// Strict YYYY-MM-DD or ISO 8601 only — rejects junk like "203-03-021" / "20261-12-3"
// that `new Date()` would otherwise accept. Frontend DatePicker sends toISOString().
const parseDate = (value) => {
  const dateValue = getSingleQueryValue(value);
  if (!dateValue) return null;

  const ymd = YMD_REGEX.exec(dateValue);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (!isValidCalendarParts(year, month, day)) return null;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const iso = ISO_REGEX.exec(dateValue);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidCalendarParts(year, month, day)) return null;
    const parsedDate = new Date(dateValue);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
};

const parseToolNames = (value) => {
  const toolsValue = getSingleQueryValue(value);
  if (!toolsValue) return [];

  return toolsValue
    .split(',')
    .map((toolName) => toolName.trim())
    .filter(Boolean);
};

const INVALID_START_DATE =
  'Invalid startDate. Please use YYYY-MM-DD format or ISO 8601 date string.';
const INVALID_END_DATE = 'Invalid endDate. Please use YYYY-MM-DD format or ISO 8601 date string.';

const parseDateRange = (startDateParam, endDateParam) => {
  const startDate = startDateParam ? parseDate(startDateParam) : null;
  const endDate = endDateParam ? parseDate(endDateParam) : null;

  if (startDateParam && !startDate) return { error: INVALID_START_DATE };
  if (endDateParam && !endDate) return { error: INVALID_END_DATE };
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
