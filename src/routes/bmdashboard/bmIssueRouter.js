const express = require('express');

const routes = function (buildingIssue, injuryIssue) {
  const IssueRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmIssueController')(
    buildingIssue,
    injuryIssue,
  );

  IssueRouter.route('/issues').get(controller.bmGetIssue);
  IssueRouter.route('/issue/add').post(controller.bmPostIssue);

  IssueRouter.route('/issues/add').post(controller.bmPostInjuryIssue);
  IssueRouter.route('/issues/list').get(controller.bmGetInjuryIssue);
  IssueRouter.route('/issues/longest-open').get(controller.getLongestOpenIssues);
  IssueRouter.route('/issues/:id/rename').put(controller.bmRenameInjuryIssue);
  IssueRouter.route('/issues/:id/copy').post(controller.bmCopyInjuryIssue);
  IssueRouter.route('/issues/:id').delete(controller.bmDeleteInjuryIssue);

  IssueRouter.route('/issue/issue-chart').get(controller.bmGetIssueChart);

  return IssueRouter;
};
<<<<<<< HEAD
=======

>>>>>>> 61eff0cf6e3f3cb3da817d052796dad32db32c67
module.exports = routes;
