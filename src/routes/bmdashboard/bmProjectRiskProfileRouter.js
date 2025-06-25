const express = require('express');
const router = express.Router();
const projectRiskProfileController = require('../../controllers/bmdashboard/projectRiskProfileController');

router.get('/projects/risk-profile', projectRiskProfileController.getRiskProfileSummary);
router.post('/projects/risk-profile', projectRiskProfileController.createRiskProfile);

module.exports = router; 