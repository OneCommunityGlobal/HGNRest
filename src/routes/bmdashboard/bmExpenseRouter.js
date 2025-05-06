const express = require('express');

module.exports = function (Expense) {
  const router = express.Router();
  const controller = require('../../controllers/bmdashboard/bmExpenseController')(Expense);

  // router.route('/projects/:id/expenses-comparison').get(controller.getExpensesComparison);
  router.get('/projects/:id/expenses-comparison', controller.getExpensesComparison);


  return router;
};
