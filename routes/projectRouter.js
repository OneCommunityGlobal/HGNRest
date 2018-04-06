var express = require('express');


var routes = function (project) {
  var controller = require('../controllers/projectController')(project);
  var projectRouter = express.Router();


  projectRouter.route('/project')
    .get(controller.getAllProjects)
    .post(controller.postProject)


  projectRouter.route('/project/:projectId')
    .get(controller.getProjectById)
    .post(controller.putProject)
    .delete(controller.deleteProject)
    .put(controller.putProject);

  projectRouter.route('/project/:projectId/task/:taskId')
    .delete(controller.deletetask);


  return projectRouter;

};

module.exports = routes;
