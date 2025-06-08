const express = require('express');

const router = express.Router();
const { getPlannedCostBreakdown } = require('../../controllers/bmdashboard/bmPlanCostBreakdownController');

router.get('/projects/:id/planned-cost-breakdown', getPlannedCostBreakdown);

module.exports = router;
