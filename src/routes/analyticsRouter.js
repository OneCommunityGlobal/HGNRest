const express = require('express');

const router = express.Router();

const analyticsController = require('../controllers/analyticsController');

// GET /analytics/overview
router.get('/overview', analyticsController.getOverview);

// GET /analytics/student/:studentId
router.get('/student/:studentId', analyticsController.getStudentMetrics);

// POST /analytics/student/:studentId/refresh
router.post('/student/:studentId/refresh', analyticsController.refreshStudentMetrics);

module.exports = router;
