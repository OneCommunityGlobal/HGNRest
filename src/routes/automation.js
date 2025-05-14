const express = require('express');
const router = express.Router();
const {
  batchOnboardMembers,
  batchOffboardMembers,
} = require('../controllers/automation/batchController');
const { authenticateToken } = require('../../middleware/auth');

// Batch operations
router.post('/batch-onboard', authenticateToken, batchOnboardMembers);
router.post('/batch-offboard', authenticateToken, batchOffboardMembers);

module.exports = router;
