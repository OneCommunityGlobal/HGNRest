const express = require('express');
const jobHitsAndApplicationsController =
  require('../../controllers/jobAnalytics/JobHitsAndApplicationsController')();

const router = express.Router();

router
  .route('/analytics/job-hits-and-applications')
  .post(jobHitsAndApplicationsController.createJobHitsAndApplications);
router
  .route('/analytics/job-hits-and-applications')
  .get(jobHitsAndApplicationsController.getJobHitsAndApplications);

module.exports = router;
