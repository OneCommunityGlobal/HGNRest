const express = require('express');
const applicationTimeController = require('../controllers/applicationTimeController');

const router = express.Router();

// GET /application-time - Main analytics endpoint
router.get('/application-time', applicationTimeController.getApplicationTimeAnalytics);

// POST /application-time - Track application time
router.post('/application-time', applicationTimeController.trackApplicationTime);

// GET /application-time/roles - Get available roles
router.get('/application-time/roles', applicationTimeController.getAvailableRoles);

// POST /application-time/detect-outliers - Manually detect outliers
router.post('/application-time/detect-outliers', applicationTimeController.detectOutliersManually);

module.exports = router;