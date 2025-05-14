const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');

// Routes for member management
router.post('/onboard', automationController.onboardNewMember);
router.post('/offboard', automationController.offboardMember);
router.post('/batch-onboard', automationController.batchOnboardMembers);
router.post('/batch-offboard', automationController.batchOffboardMembers);

module.exports = router;
