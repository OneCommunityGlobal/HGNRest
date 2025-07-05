const express = require('express');

const routes = function (metIssue, injuryIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmIssueController')(metIssue, injuryIssue);

    // Met Issues
    IssueRouter.route('/issues')
        .get(controller.bmGetMetIssue);
    IssueRouter.route('/issue/add')
<<<<<<< HEAD
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
=======
        .post(controller.bmPostIssue);
    IssueRouter.route('/issue/issue-chart')
        .get(controller.bmGetIssueChart); 
>>>>>>> a60a9519836095a66b2ff7f922c5211ca37adc8c
    return IssueRouter;
};
module.exports = routes;
