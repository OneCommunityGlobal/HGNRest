const express = require('express');

const analyticsRouter = express.Router();
const Applicant = require('../models/jobApplicants');
// const Applicant = require('../../models/jobApplicants.js');
const analyticsControllerFactory = require('../controllers/applicantAnalyticsController');
// const analyticsControllerFactory = require('../../controllers/applicantAnalyticsController');

const controller = analyticsControllerFactory(Applicant);

analyticsRouter.get('/experience-breakdown', controller.getExperienceBreakdown);
analyticsRouter.get('/applicant-sources', controller.getApplicantSources);

module.exports = analyticsRouter;
