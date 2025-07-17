// alisha
const express = require('express');

const router = express.Router();

const CandidateOPTStatus = require('../models/CandidateOPTStatus');
const optAnalyticsController = require('../controllers/optAnalyticsController');

const { getOptStatusBreakdown } = optAnalyticsController(CandidateOPTStatus);

router.get('/opt-status', getOptStatusBreakdown);

module.exports = router;
