const express = require('express');
const controller = require('../../controllers/bmdashboard/weeklyProjectSummaryController');

const router = express.Router();

router.get('/project-status', controller.getProjectStatus);

module.exports = router;
