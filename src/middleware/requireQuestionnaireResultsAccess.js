const FormResponse = require('../models/hgnFormResponse');

const ADMIN_ROLES = new Set(['Administrator', 'Owner']);

const requireQuestionnaireResultsAccess = async (req, res, next) => {
  try {
    const { requestorId, role } = req.user || {};

    if (!requestorId) {
      return res.status(401).json({
        message: 'User not authenticated',
      });
    }

    if (ADMIN_ROLES.has(role)) {
      return next();
    }

    const questionnaireResponse = await FormResponse.findOne({
      user_id: requestorId,
    });

    if (!questionnaireResponse) {
      return res.status(403).json({
        message: 'Complete the HGN Skills Questionnaire to access results.',
      });
    }

    return next();
  } catch (error) {
    console.error('Questionnaire results authorization error:', error);

    return res.status(500).json({
      message: 'Unable to verify questionnaire access.',
    });
  }
};

module.exports = requireQuestionnaireResultsAccess;
