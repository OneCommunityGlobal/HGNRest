const express = require('express');
const controller = require('../../controllers/bmdashboard/bmExpenditureController');
const {
  getProjectExpensesPie,
  getProjectIdsWithExpenditure,
} = require('../../controllers/bmdashboard/expenditureController');

const routes = function () {
  const newExpenditureRouter = express.Router();

  newExpenditureRouter.route('/expenditure').get(controller.getAllExpenditure);
  newExpenditureRouter.get('/expenditure/projects', getProjectIdsWithExpenditure);
  newExpenditureRouter.get('/expenditure/:projectId/pie', getProjectExpensesPie);

  return newExpenditureRouter;
};

module.exports = routes;
