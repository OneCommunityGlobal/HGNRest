const express = require('express');

const routes = function (buildingIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmMostExpensiveIssueController')(buildingIssue);

    IssueRouter.route('/issues/most-expensive')
        .get(controller.bmGetIssue);
    IssueRouter.route('/issues/projects')
        .get(controller.getUniqueProjectIds);
    return IssueRouter;
};
module.exports = routes;
