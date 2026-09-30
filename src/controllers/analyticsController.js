const analyticsService = require('../services/analyticsService');

// Controller for analytics endpoints
const getOverview = async (req, res) => {
  try {
    const overview = await analyticsService.getOverview();
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

module.exports = {
  getOverview,
  getStudentMetrics,
};
