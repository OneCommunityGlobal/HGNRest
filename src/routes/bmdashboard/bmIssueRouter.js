const express = require('express');
const controller = require('../../controllers/bmdashboard/bmIssueController');
const issueAnalyticsController =
  require('../../controllers/bmdashboard/issueAnalyticsController')();

const router = express.Router();

router.get('/issues', controller.bmGetIssue);
router.post('/issue/add', controller.bmPostIssue);
router.get('/issue/issue-chart', controller.bmGetIssueChart);
router.get('/issues/longest-open', controller.getLongestOpenIssues);

router.get('/trends', issueAnalyticsController.getIssueTrends);
router.get('/summary', issueAnalyticsController.getIssueSummary);

module.exports = router;
