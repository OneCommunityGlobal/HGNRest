const express = require('express');

const routes = () => {
  const newIssueRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmNewIssueController')();

  newIssueRouter.route('/getnewissue').get(controller.bmGetIssueList);

  newIssueRouter.route('/postnewissue').post(controller.bmPostNewIssue);
};

module.exports = routes;
