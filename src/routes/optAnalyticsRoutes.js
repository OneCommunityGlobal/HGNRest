// routes/optAnalyticsRoutes.js

const express = require('express');

const router = express.Router();

const CandidateOPTStatus = require('../models/CandidateOPTStatus');
const optAnalyticsController = require('../controllers/optAnalyticsController');

const analyticsController = optAnalyticsController(CandidateOPTStatus);

router.get('/opt-status', analyticsController.getOPTStatusBreakdown);

module.exports = router;
