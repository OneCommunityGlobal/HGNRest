const analyticsService = require('../services/analyticsService');

const parseOverviewDate = (value, isEndDate = false) => {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined;
  if (isEndDate) date.setUTCHours(23, 59, 59, 999);
  return date;
};

// Controller for analytics endpoints
const getOverview = async (req, res) => {
  try {
    const startDate = parseOverviewDate(req.query.startDate);
    const endDate = parseOverviewDate(req.query.endDate, true);
    if (startDate === undefined || endDate === undefined) {
      return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format' });
    }
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ error: 'startDate must be before or equal to endDate' });
    }

    const overview = await analyticsService.getOverview({
      studentId: req.query.studentId,
      classId: req.query.classId,
      startDate,
      endDate,
    });
    // short cache header for frontend dashboards
    res.set('Cache-Control', 'public, max-age=60');
    return res.json(overview);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getStudentMetrics = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

    // Optionally allow callers to force refresh via query param
    const force = req.query.force === 'true' || req.query.force === '1';

    const metrics = await analyticsService.getStudentMetrics(studentId, { forceRefresh: force });
    res.set('Cache-Control', 'private, max-age=30');
    return res.json({ studentId, metrics });
  } catch (error) {
    console.error('Error fetching student metrics:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const refreshStudentMetrics = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

    const metrics = await analyticsService.refreshStudentMetrics(studentId);
    return res.json({ studentId, metrics });
  } catch (error) {
    console.error('Error refreshing student metrics:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getOverview,
  getStudentMetrics,
  refreshStudentMetrics,
};
