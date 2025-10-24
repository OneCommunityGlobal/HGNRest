const express = require('express');
const router = express.Router();
const Applicant = require('../models/jobApplicants');
const experienceBreakdownController = require('../controllers/applicantAnalyticsController');

const { getExperienceBreakdown } = experienceBreakdownController(Applicant);

router.get('/experience-breakdown', getExperienceBreakdown);

module.exports = router;
