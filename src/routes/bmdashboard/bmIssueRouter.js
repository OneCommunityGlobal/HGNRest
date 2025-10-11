const express = require('express');

const routes = function (metIssue) {
  const IssueRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmIssueController')(metIssue);
  const issueAnalyticsController =
    require('../../controllers/bmdashboard/issueAnalyticsController')();

  IssueRouter.route('/issues').get(controller.bmGetIssue);
  IssueRouter.route('/issue/add').post(controller.bmPostIssue);
  IssueRouter.route('/issue/issue-chart').get(controller.bmGetIssueChart);
  IssueRouter.route('/issues/longest-open').get(controller.getLongestOpenIssues);

  // New routes for issue analytics
  IssueRouter.route('/trends').get(issueAnalyticsController.getIssueTrends);
  IssueRouter.route('/summary').get(issueAnalyticsController.getIssueSummary);
  return IssueRouter;
};
module.exports = routes;
