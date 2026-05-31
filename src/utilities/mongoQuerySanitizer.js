const mongoose = require('mongoose');

const JOB_FORM_CATEGORIES = new Set([
  'General',
  'Engineering',
  'Marketing',
  'Design',
  'Management',
  'Data Analysis',
  'Content Creation',
  'Business Development',
  'Other',
]);

/** Plain string from input; rejects objects/arrays and MongoDB operator strings. */
function sanitizeQueryString(value) {
  if (value === null || value === undefined || typeof value === 'object') return null;
  const s = String(value).trim();
  if (!s || s.startsWith('$')) return null;
  return s;
}

function parseBooleanQuery(value) {
  if (value === null || value === undefined || typeof value === 'object') return null;
  const s = String(value).trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}

function sanitizeObjectIdQuery(value) {
  const s = sanitizeQueryString(value);
  if (!s || !mongoose.Types.ObjectId.isValid(s)) return null;
  return s;
}

function sanitizeCategory(value) {
  const s = sanitizeQueryString(value);
  if (!s || !JOB_FORM_CATEGORIES.has(s)) return null;
  return s;
}

function sanitizeTargetRole(value) {
  return sanitizeQueryString(value);
}

function buildJobFormsListFilter(query = {}) {
  const filter = {};
  const category = sanitizeCategory(query.category);
  if (category) {
    filter.category = category;
  }
  const isActive = parseBooleanQuery(query.isActive);
  if (isActive !== null) {
    filter.isActive = isActive;
  }
  const createdBy = sanitizeObjectIdQuery(query.createdBy);
  if (createdBy) {
    filter.createdBy = createdBy;
  }
  return filter;
}

function buildQuestionSetListFilter(query = {}) {
  const filter = {};
  const category = sanitizeCategory(query.category);
  if (category) {
    filter.category = category;
  }
  const targetRole = sanitizeTargetRole(query.targetRole);
  if (targetRole) {
    filter.targetRole = targetRole;
  }
  const isActive = parseBooleanQuery(query.isActive);
  if (isActive !== null) {
    filter.isActive = isActive;
  }
  const createdBy = sanitizeObjectIdQuery(query.createdBy);
  if (createdBy) {
    filter.createdBy = createdBy;
  }
  return filter;
}

module.exports = {
  JOB_FORM_CATEGORIES,
  sanitizeQueryString,
  sanitizeCategory,
  sanitizeTargetRole,
  parseBooleanQuery,
  sanitizeObjectIdQuery,
  buildJobFormsListFilter,
  buildQuestionSetListFilter,
};
