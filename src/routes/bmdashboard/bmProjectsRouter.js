const express = require('express');

const routes = function () {
const materialsRouter = express.Router();
const controller = require('../../controllers/bmdashboard/bmProjectsController')();

materialsRouter.route('/getUserActiveBMProjects')
  .get(controller.getUserActiveBMProjects);

  return materialsRouter;
};

module.exports = routes;
