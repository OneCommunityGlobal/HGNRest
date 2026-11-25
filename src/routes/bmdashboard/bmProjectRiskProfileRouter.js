// v1.0.0
const express = require('express');

const router = express.Router();
const projectRiskProfileController = require('../../controllers/bmdashboard/projectRiskProfileController');

router.get('/projects/risk-profile', projectRiskProfileController.getRiskProfileSummary);
const canManageRisk = (req, res, next) => {
  if (!['Owner', 'Administrator'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Administrator or Owner access required' });
  }
  return next();
};
router.post(
  '/projects/risk-profile',
  canManageRisk,
  projectRiskProfileController.createRiskProfile,
);
router.patch(
  '/projects/risk-profile/:projectId',
  canManageRisk,
  projectRiskProfileController.updateRiskProfile,
);

module.exports = router;
