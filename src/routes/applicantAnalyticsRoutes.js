const express = require('express');

const router = express.Router();
const Applicant = require('../models/jobApplicants');
const AnonymousInteraction = require('../models/anonymousInteraction');
const AnonymousApplication = require('../models/anonymousApplication');
const AnalyticsSummary = require('../models/analyticsSummary');
const analyticsController = require('../controllers/applicantAnalyticsController');

const {
  getExperienceBreakdown,
  getAllRoles,
  trackInteraction,
  trackApplication,
  getInteractionSummary,
  getConversionMetrics,
  triggerAggregation
} = analyticsController(Applicant, AnonymousInteraction, AnonymousApplication, AnalyticsSummary);

router.get('/experience-breakdown', getExperienceBreakdown);
router.get('/experience-roles', getAllRoles);

// public - no auth required
router.post('/track-interaction', trackInteraction);
router.post('/track-application', trackApplication);

// admin only - auth handled in controller
router.get('/summary', getInteractionSummary);
router.get('/conversions', getConversionMetrics);

// Manual aggregation trigger (admin only - backup for cron job)
router.post('/trigger-aggregation', triggerAggregation);

module.exports = router;
