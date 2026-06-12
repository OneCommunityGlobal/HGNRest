<<<<<<< HEAD
/* eslint-disable */
const express = require('express');
const controller = require('../../controllers/bmdashboard/bmExpenditureController');

const routes = function () {
    const newExpenditureRouter = express.Router();
    newExpenditureRouter.route('/expenditure').get(controller.getAllExpenditure);

    return newExpenditureRouter;
};

module.exports = routes;
=======
const express = require('express');

const router = express.Router();
const {
  getProjectExpensesPie,
  getProjectIdsWithExpenditure,
} = require('../../controllers/bmdashboard/expenditureController');

router.get('/expenditure/:projectId/pie', getProjectExpensesPie);
router.get('/expenditure/projects', getProjectIdsWithExpenditure);

module.exports = router;
>>>>>>> origin/development
