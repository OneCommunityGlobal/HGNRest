const express = require('express');

const routes = function (buildingIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmIssueController')(buildingIssue);

    IssueRouter.route('/issues')
        .get(controller.bmGetIssue);
    IssueRouter.route('/issue/add')
        .post(controller.bmPostIssue);
    IssueRouter.route('/issues/:id')
        .patch(controller.bmUpdateIssue);
    IssueRouter.route('/issues/:id')
        .delete(controller.bmDeleteIssue);
    return IssueRouter;
};
module.exports = routes;
