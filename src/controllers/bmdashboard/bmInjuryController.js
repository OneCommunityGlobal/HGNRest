const mongoose = require('mongoose');
const buildingProject = require('../../models/bmdashboard/buildingProject');

const SEVERITIES = ['Minor', 'Major', 'Critical'];
const NAME_PATTERN = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const DESCRIPTION_PATTERN = /[A-Za-z]{2,}/;
const INVALID_DESCRIPTION_PATTERN = /[<>]/;

const MAX_NAME_LENGTH = 100;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 500;
const INJURY_COUNT = 1;

const parseIncidentDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const validateName = (value) =>
  typeof value === 'string' &&
  value.trim().length <= MAX_NAME_LENGTH &&
  NAME_PATTERN.test(value.trim());

const validateDescription = (value) => {
  const description = typeof value === 'string' ? value.trim() : '';

  if (
    description.length < MIN_DESCRIPTION_LENGTH ||
    description.length > MAX_DESCRIPTION_LENGTH ||
    !DESCRIPTION_PATTERN.test(description) ||
    INVALID_DESCRIPTION_PATTERN.test(description)
  ) {
    return false;
  }

  return true;
};

const getTodayUTC = () => {
  const today = new Date();

  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
};

const validateInjuryPayload = (body) => {
  const { projectId, date, injuryType, workerCategory, severity, description } = body || {};

  if (typeof projectId !== 'string' || !mongoose.Types.ObjectId.isValid(projectId)) {
    return { error: 'Invalid project identifier.' };
  }

  const incidentDate = parseIncidentDate(date);

  if (!incidentDate) {
    return {
      error: 'Enter a valid incident date in YYYY-MM-DD format.',
    };
  }

  if (incidentDate > getTodayUTC()) {
    return {
      error: 'Incident date cannot be in the future.',
    };
  }

  if (!SEVERITIES.includes(severity)) {
    return {
      error: 'Select a valid injury severity.',
    };
  }

  if (!validateName(injuryType)) {
    return {
      error: 'Enter a valid injury type using letters.',
    };
  }

  if (!validateName(workerCategory)) {
    return {
      error: 'Enter a valid worker category using letters.',
    };
  }

  if (!validateDescription(description)) {
    return {
      error: 'Enter a valid incident description (10–500 characters).',
    };
  }

  return {
    data: {
      projectId,
      date: incidentDate,
      injuryType: injuryType.trim(),
      workerCategory: workerCategory.trim(),
      department: workerCategory.trim(),
      severity,
      description: description.trim(),
      count: INJURY_COUNT,
    },
  };
};

const buildInjuryQuery = (params) => {
  const { projectIds, startDate, endDate, types, departments } = params;
  const query = {};

  if (projectIds) {
    const ids = projectIds.split(',').map((id) => id.trim());

    if (!ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
      return { error: 'One or more project identifiers are invalid.' };
    }

    query.projectId = {
      $in: ids.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { error: 'Invalid date range.' };
    }

    query.date = {
      $gte: start,
      $lte: end,
    };
  }

  if (types) {
    query.injuryType = {
      $in: types.split(',').map((value) => value.trim()),
    };
  }

  if (departments) {
    query.department = {
      $in: departments.split(',').map((value) => value.trim()),
    };
  }

  return { query };
};

const injuryController = function (injurySeverity) {
  const postInjury = async (req, res) => {
    try {
      const validation = validateInjuryPayload(req.body);

      if (validation.error) {
        return res.status(400).json({
          error: validation.error,
        });
      }

      const project = await buildingProject.findById(validation.data.projectId).select('name');

      if (!project) {
        return res.status(404).json({
          error: 'Project not found.',
        });
      }

      const newRecord = await injurySeverity.create({
        ...validation.data,
        projectName: project.name,
      });

      return res.status(201).json({
        message: 'Injury incident saved successfully.',
        injury: newRecord,
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Unable to save the injury incident.',
      });
    }
  };

  const getInjuries = async (req, res) => {
    try {
      const { query, error } = buildInjuryQuery(req.query);

      if (error) {
        return res.status(400).json({ error });
      }

      const result = await injurySeverity.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              projectId: '$projectId',
              projectName: '$projectName',
              severity: '$severity',
              department: '$department',
            },
            totalInjuries: { $sum: '$count' },
          },
        },
        {
          $project: {
            _id: 0,
            projectId: '$_id.projectId',
            projectName: '$_id.projectName',
            severity: '$_id.severity',
            department: '$_id.department',
            totalInjuries: 1,
          },
        },
      ]);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        error: 'Unable to fetch injury data.',
      });
    }
  };

  return { postInjury, getInjuries };
};

module.exports = injuryController;
