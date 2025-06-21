const express = require('express');

const routes = function (buildingIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmIssueController')(buildingIssue);

    IssueRouter.route('/issues/open')
        .get(controller.bmGetIssue);
    IssueRouter.route('/issue/add')
        .post(controller.bmPostIssue);
    IssueRouter.route('/issues/:id')
        .patch(controller.bmUpdateIssue);
    IssueRouter.route('/issues/:id')
        .delete(controller.bmDeleteIssue);
    IssueRouter.route('/issues/projects')
        .get(controller.getUniqueProjectIds);
    return IssueRouter;
};
module.exports = routes;
