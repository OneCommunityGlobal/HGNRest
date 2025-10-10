const express = require('express');

const routes = function (metIssue) {
  const IssueRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmIssueController')(metIssue);
  const issueController = require('../../controllers/bmdashboard/issueAnalyticsController');

  IssueRouter.route('/issues').get(controller.bmGetIssue);
  IssueRouter.route('/issue/add').post(controller.bmPostIssue);
  IssueRouter.route('/issue/issue-chart').get(controller.bmGetIssueChart);
  IssueRouter.route('/issues/longest-open').get(controller.getLongestOpenIssues);

  // New routes for issue analytics
  IssueRouter.route('/trends').get(issueController.getAllIssueAnalytics);
  IssueRouter.route('/summary').get(issueController.getIssueAnalyticsById);
  return IssueRouter;
};
module.exports = routes;
