// Expense Routes
const express = require('express');
const { getExpensesByProject } = require('../../controllers/bmdashboard/bmActualVsPlannedCostController')

const router = express.Router();

// GET expenses by project ID
router.get('/project/:projectId/expenses', getExpensesByProject);
module.exports = router;
