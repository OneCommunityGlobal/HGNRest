const express = require('express');

const routes = function (metIssue, injuryIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmIssueController')(metIssue, injuryIssue);

    // Met Issues
    IssueRouter.route('/issues')
        .get(controller.bmGetMetIssue);
    IssueRouter.route('/issue/add')
        .post(controller.bmPostMetIssue);

    // Injury Issue
    IssueRouter.route('/issues/add')
        .post(controller.bmPostInjuryIssue);
    IssueRouter.route('/issues/list')
        .get(controller.bmGetInjuryIssue);
    IssueRouter.route('/issues/:id')
        .delete(controller.bmDeleteInjuryIssue);
    IssueRouter.route('/issues/:id/rename')
        .put(controller.bmRenameInjuryIssue);
    IssueRouter.route('/issues/:id/copy')
        .post(controller.bmCopyInjuryIssue);
    return IssueRouter;
};
module.exports = routes;
