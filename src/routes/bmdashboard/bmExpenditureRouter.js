const express = require('express');

const router = express.Router();
const {
  getProjectExpensesPie,
  getProjectIdsWithExpenditure,
} = require('../../controllers/bmdashboard/expenditureController');

router.get('/expenditure/projects', getProjectIdsWithExpenditure);
router.get('/expenditure/:projectId/pie', getProjectExpensesPie);

module.exports = router;
