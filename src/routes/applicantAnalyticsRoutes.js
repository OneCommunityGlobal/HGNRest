const express = require('express');

const applicantAnalyticsRouter = express.Router();
const Applicant = require('../models/jobApplicants');
const experienceBreakdownController = require('../controllers/applicantAnalyticsController');

const { getExperienceBreakdown, getAllRoles } = experienceBreakdownController(Applicant);

applicantAnalyticsRouter.get('/experience-breakdown', getExperienceBreakdown);
applicantAnalyticsRouter.get('/experience-roles', getAllRoles);

module.exports = applicantAnalyticsRouter;
