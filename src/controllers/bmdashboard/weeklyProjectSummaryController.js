const dayjs = require('dayjs');
const mongoose = require('mongoose');
const logger = require('../../startup/logger');
const {
  getWeeklyProjectSummaryProjectStatus,
} = require('../../services/bmdashboard/weeklyProjectSummaryService');

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  const parsedDate = dayjs(value);
  return (
    typeof value === 'string' &&
    DATE_FORMAT.test(value) &&
    parsedDate.isValid() &&
    parsedDate.format('YYYY-MM-DD') === value
  );
}

function validateDateRange(startDate, endDate, startLabel = 'startDate', endLabel = 'endDate') {
  if (!startDate) return `${startLabel} is required`;
  if (!endDate) return `${endLabel} is required`;
  if (!isValidDateString(startDate)) return `${startLabel} must be YYYY-MM-DD`;
  if (!isValidDateString(endDate)) return `${endLabel} must be YYYY-MM-DD`;
  if (dayjs(startDate).isAfter(dayjs(endDate))) {
    return `${startLabel} must be before or equal to ${endLabel}`;
  }
  return null;
}

function validateQuery(query = {}) {
  const { startDate, endDate, comparisonStartDate, comparisonEndDate, projectId } = query;
  const rangeError = validateDateRange(startDate, endDate);
  if (rangeError) return rangeError;

  if ((comparisonStartDate && !comparisonEndDate) || (!comparisonStartDate && comparisonEndDate)) {
    return 'comparisonStartDate and comparisonEndDate must be supplied together';
  }

  if (comparisonStartDate || comparisonEndDate) {
    const comparisonError = validateDateRange(
      comparisonStartDate,
      comparisonEndDate,
      'comparisonStartDate',
      'comparisonEndDate',
    );
    if (comparisonError) return comparisonError;
  }

  if (projectId && projectId !== 'all' && !mongoose.Types.ObjectId.isValid(projectId)) {
    return 'projectId must be a valid ObjectId or "all"';
  }

  return null;
}

async function getProjectStatus(req, res) {
  try {
    const validationError = validateQuery(req.query);
    if (validationError) {
      return res.status(400).json({ error: 'Validation Error', message: validationError });
    }

    const data = await getWeeklyProjectSummaryProjectStatus(req.query);
    return res.status(200).json(data);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }

    const trackingId = logger.logException(
      error,
      'weeklyProjectSummaryController.getProjectStatus',
      { endpoint: '/weekly-project-summary/project-status', query: req.query },
    );
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching weekly project summary metrics',
      trackingId,
    });
  }
}

module.exports = {
  getProjectStatus,
  testExports: {
    isValidDateString,
    validateDateRange,
    validateQuery,
  },
};
