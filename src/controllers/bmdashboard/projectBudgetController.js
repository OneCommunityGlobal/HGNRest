const mongoose = require('mongoose');
const ProjectBudget = require('../../models/bmdashboard/projectBudget');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const logger = require('../../startup/logger');
const { CATEGORY_LABELS, EXPENDITURE_TYPE_KEYS } = require('../../utilities/projectBudgetHelper');

const ADMIN_ROLES = new Set(['Administrator', 'Owner']);
const MAX_HISTORY = 50;
const SUM_TOLERANCE = 0.01;
const USER_FIELDS = 'firstName lastName';

const isAdmin = (req) => ADMIN_ROLES.has(req.body?.requestor?.role);

const isBlank = (value) => value === undefined || value === null || value === '';

const toAmount = (value) => (isBlank(value) ? Number.NaN : Number(value));

const isValidAmount = (value) => Number.isFinite(value) && value >= 0;

const findBudget = (projectId) =>
  ProjectBudget.findOne({ projectId })
    .populate('setBy', USER_FIELDS)
    .populate('history.setBy', USER_FIELDS)
    .lean();

// Validates the PUT body. Returns { errors } or { value } ready to save.
const parseBudget = (body = {}) => {
  const errors = [];

  const categories = {};
  Object.keys(CATEGORY_LABELS).forEach((key) => {
    categories[key] = toAmount(body.categories?.[key]);
    if (!isValidAmount(categories[key])) {
      errors.push(`${CATEGORY_LABELS[key]} must be a number of 0 or more`);
    }
  });
  const total = Object.values(categories).reduce((sum, v) => sum + v, 0);
  if (errors.length === 0 && total <= 0) {
    errors.push('The total budget must be greater than 0');
  }

  // The expenditure-type split is optional; once any type is filled in, all four are needed
  // and they must add up to the same total as the categories
  let expenditureTypes;
  const rawTypes = body.expenditureTypes || {};
  if (EXPENDITURE_TYPE_KEYS.some((key) => !isBlank(rawTypes[key]))) {
    expenditureTypes = {};
    EXPENDITURE_TYPE_KEYS.forEach((key) => {
      expenditureTypes[key] = toAmount(rawTypes[key]);
      if (!isValidAmount(expenditureTypes[key])) {
        errors.push(`${key[0].toUpperCase()}${key.slice(1)} must be a number of 0 or more`);
      }
    });
    const typeTotal = Object.values(expenditureTypes).reduce((sum, v) => sum + v, 0);
    if (errors.length === 0 && Math.abs(typeTotal - total) > SUM_TOLERANCE) {
      errors.push('Expenditure types must add up to the category total');
    }
  }

  const effectiveDate = new Date(body.effectiveDate);
  if (isBlank(body.effectiveDate) || Number.isNaN(effectiveDate.getTime())) {
    errors.push('Effective date is required');
  }

  return errors.length ? { errors } : { value: { categories, expenditureTypes, effectiveDate } };
};

const getProjectBudget = async (req, res) => {
  const { projectId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Invalid project ID' });
  }

  try {
    const budget = await findBudget(projectId);
    return res.status(200).json({ budget: budget || null });
  } catch (error) {
    logger.logException(error, 'projectBudgetController.getProjectBudget', { projectId });
    return res.status(500).json({ message: 'Failed to retrieve the project budget' });
  }
};

const setProjectBudget = async (req, res) => {
  const { projectId } = req.params;

  if (!isAdmin(req)) {
    return res.status(403).json({ message: 'Only Owners and Administrators can set budgets' });
  }
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Invalid project ID' });
  }

  const { errors, value } = parseBudget(req.body);
  if (errors) {
    return res.status(400).json({ message: errors.join('. '), errors });
  }

  try {
    const project = await BuildingProject.exists({ _id: projectId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const next = { ...value, setBy: req.body.requestor.requestorId };
    const existing = await ProjectBudget.findOne({ projectId });

    if (existing) {
      const previous = existing.toObject();
      const snapshot = {
        categories: previous.categories,
        expenditureTypes: previous.expenditureTypes,
        effectiveDate: previous.effectiveDate,
        setBy: previous.setBy,
        setAt: previous.updatedAt || previous.createdAt || new Date(),
      };
      existing.history = [snapshot, ...(previous.history || [])].slice(0, MAX_HISTORY);
      existing.set(next);
      if (!value.expenditureTypes) existing.set('expenditureTypes', undefined);
      await existing.save();
    } else {
      await ProjectBudget.create({ projectId, ...next, history: [] });
    }

    const budget = await findBudget(projectId);
    return res.status(200).json({ budget });
  } catch (error) {
    logger.logException(error, 'projectBudgetController.setProjectBudget', { projectId });
    return res.status(500).json({ message: 'Failed to save the project budget' });
  }
};

module.exports = { getProjectBudget, setProjectBudget, parseBudget };
