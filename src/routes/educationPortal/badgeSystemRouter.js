const express = require('express');
const badgeController = require('../../controllers/educationPortal/badgeSystemController');

const router = express.Router();

router.get('/student/badges', badgeController.getStudentBadges);

router.get('/student/badges/reason/:reason', badgeController.getStudentBadgesByReason);


router.post('/badges', badgeController.createBadge);

router.get('/badges', badgeController.getAllBadges);

router.put('/badges/:badge_id', badgeController.updateBadge);
router.post('/badges/award', badgeController.awardBadge);

router.delete('/badges/:student_badge_id/revoke', badgeController.revokeBadge);

module.exports = router;