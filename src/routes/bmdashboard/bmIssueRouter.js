const express = require('express');

const routes = function (metIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmIssueController')(metIssue);

    IssueRouter.route('/issues')
        .get(controller.bmGetIssue);
    IssueRouter.route('/issue/add')
        .post(controller.bmPostIssue);
    IssueRouter.route('/issues/:id')
        .patch(controller.bmUpdateIssueName);
    return IssueRouter;
};
module.exports = routes;
