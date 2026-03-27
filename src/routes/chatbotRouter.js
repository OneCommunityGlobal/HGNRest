const express = require('express');
const chatbotService = require('../services/chatbotService');

const router = express.Router();

router.post('/chatbot/query', (req, res) => {
  const { message, history } = req.body || {};
  const normalizedHistory = Array.isArray(history) ? history : [];

  chatbotService
    .getChatbotReply(message, normalizedHistory)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(500).json({
        reply: 'An error occurred while processing your request.',
        sources: [],
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    });
});

module.exports = router;
