const express = require('express');

const routes = function (buildingIssue) {
    const IssueRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmIssueController')(buildingIssue);

    IssueRouter.route('/issues/most-expensive')
        .get(controller.bmGetIssue);
    return IssueRouter;
};
module.exports = routes;
