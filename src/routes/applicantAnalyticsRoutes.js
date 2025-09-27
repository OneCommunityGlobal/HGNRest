const express = require('express');

const router = express.Router();
const Applicant = require('../models/jobApplicants');
const experienceBreakdownController = require('../controllers/applicantAnalyticsController');

const { getExperienceBreakdown, getAllRoles } = experienceBreakdownController(Applicant);

router.get('/experience-breakdown', getExperienceBreakdown);
router.get('/experience-roles', getAllRoles);
module.exports = router;
