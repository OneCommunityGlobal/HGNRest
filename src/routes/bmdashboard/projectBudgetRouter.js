const express = require('express');
const {
  getProjectBudget,
  setProjectBudget,
} = require('../../controllers/bmdashboard/projectBudgetController');

const router = express.Router();

router.get('/project/:projectId/budget', getProjectBudget);
router.put('/project/:projectId/budget', setProjectBudget);

module.exports = router;
