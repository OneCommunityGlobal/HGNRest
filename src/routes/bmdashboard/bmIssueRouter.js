const express = require('express');

const routes = function (metIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmIssueController')(metIssue);

    IssueRouter.route('/issues')
        .get(controller.bmGetIssue);
    IssueRouter.route('/issue/add')
        .post(controller.bmPostIssue);
    return IssueRouter;
};
module.exports = routes;
