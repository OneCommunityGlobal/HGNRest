/* eslint-disable import/newline-after-import */

const express = require('express');
const router = express.Router();

module.exports = function(injury) {
  // Import the controller and pass the injury model
  const injuriesController = require('../../controllers/bmdashboard/injuryController')(injury);
  
  // Define routes and map them to controller methods
  router.get('/injuries/over-time', injuriesController.getInjuriesOverTime);
  router.get('/injuries/filter-options', injuriesController.getFilterOptions);
  router.post('/injuries', injuriesController.createInjury);
  router.get('/injuries/project/:projectId', injuriesController.getProjectInjuries);
  
  return router;
};