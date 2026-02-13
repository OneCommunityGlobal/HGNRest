const express = require('express');

const healthRouter = express.Router();

healthRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = healthRouter; 