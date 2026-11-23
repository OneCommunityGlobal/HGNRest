const express = require('express');
const controller = require('../../controllers/bmdashboard/weeklyProjectSummaryController');

const router = express.Router();

router.get('/project-status', controller.getProjectStatus);
router.get('/financial-overview', controller.getFinancialOverview);

module.exports = router;
