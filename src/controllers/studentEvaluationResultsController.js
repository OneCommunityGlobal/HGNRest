const evaluationResultsService = require('../services/studentEvaluationResultsService');

const mapServiceError = (error, res) => {
  if (error.message === 'Invalid student ID provided.') {
    return res.status(400).json({ error: error.message });
  }

  if (error.message === 'Student profile not found.') {
    return res.status(404).json({ error: error.message });
  }

  return res.status(500).json({
    error: 'Internal server error',
    details: error.message,
  });
};

const studentEvaluationResultsController = function () {
  const getRequestorId = (req) => req.body?.requestor?.requestorId;

  const getEvaluationResults = async (req, res) => {
    try {
      const studentId = getRequestorId(req);

      if (!studentId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const results = await evaluationResultsService.getStudentEvaluationResults(studentId);
      await evaluationResultsService.markEvaluationResultsViewed(studentId);

      return res.status(200).json(results);
    } catch (error) {
      return mapServiceError(error, res);
    }
  };

  const getEvaluationResultNotifications = async (req, res) => {
    try {
      const studentId = getRequestorId(req);

      if (!studentId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const notifications =
        await evaluationResultsService.getEvaluationResultNotifications(studentId);

      return res.status(200).json(notifications);
    } catch (error) {
      return mapServiceError(error, res);
    }
  };

  return {
    getEvaluationResults,
    getEvaluationResultNotifications,
  };
};

module.exports = studentEvaluationResultsController;
