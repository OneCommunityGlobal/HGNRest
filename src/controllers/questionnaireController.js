const FormResponse = require('../models/hgnFormResponse');

const questionnaireController = () => {
  const getQuestionnaireStatus = async (req, res) => {
    try {
      const userId = req.user?.requestorId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const response = await FormResponse.findOne({ user_id: userId });

      return res.status(200).json({
        completed: Boolean(response),
      });
    } catch (error) {
      console.error('Questionnaire status error:', error);
      return res.status(500).json({
        error: 'Unable to check questionnaire status',
      });
    }
  };

  return { getQuestionnaireStatus };
};

module.exports = questionnaireController;
