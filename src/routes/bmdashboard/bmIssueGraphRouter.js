const express = require('express');
const issueAnalyticsController =
  require('../../controllers/bmdashboard/issueAnalyticsController')();

const router = express.Router();

router.get('/issues/trends', issueAnalyticsController.getIssueTrends);
router.get('/issues/summary', issueAnalyticsController.getIssueSummary);

module.exports = router;
