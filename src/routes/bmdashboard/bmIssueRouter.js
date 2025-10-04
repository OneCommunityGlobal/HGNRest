const express = require('express');

const routes = function (buildingIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmIssueController')(buildingIssue);

    IssueRouter.route('/issues/open')
        .get(controller.bmGetOpenIssue);
    IssueRouter.route('/issue/add')
        .post(controller.bmPostIssue);
    IssueRouter.route('/issues/:id')
        .patch(controller.bmUpdateIssue);
    IssueRouter.route('/issues/:id')
        .delete(controller.bmDeleteIssue);
    IssueRouter.route('/issues/projects')
        .get(controller.getUniqueProjectIds);
    IssueRouter.route('/issues')
        .get(controller.bmGetIssue);
    IssueRouter.route('/issue/issue-chart')
        .get(controller.bmGetIssueChart);
    IssueRouter.route('/issues/longest-open')
        .get(controller.getLongestOpenIssues);
    return IssueRouter;
};
module.exports = routes;
