const express = require('express');

const routes = function (projectDetail) {

const projectRouter = express.Router();
const controller = require('../../controllers/bmdashboard/bmProjectDetailController')(projectDetail);

projectRouter.route('/projects/:projectId')
    .get(controller.bmProjectDetails);

    return projectRouter;

};

module.exports = routes;