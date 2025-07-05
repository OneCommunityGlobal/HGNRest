const express = require('express');

const router = express.Router();
const ApplicantJobStatus = require('../models/applicantsJobStatus');
const applicantsJobStatusController = require('../controllers/applicantsJobStatusController');

const { getApplicantsJobStatus } = applicantsJobStatusController(ApplicantJobStatus);
router.get('/opt-status', getApplicantsJobStatus);

module.exports = router;
