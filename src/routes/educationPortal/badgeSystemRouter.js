const express = require('express');
const badgeController = require('../../controllers/educationPortal/badgeSystemController');
const auth = require('../../middleware/auth'); // Assuming you have auth middleware
const adminAuth = require('../../middleware/adminAuth'); // Assuming you have admin middleware

const router = express.Router();

router.get('/student/badges', auth, badgeController.getStudentBadges);

router.get('/student/badges/reason/:reason', auth, badgeController.getStudentBadgesByReason);


router.post('/badges', adminAuth, badgeController.createBadge);

router.get('/badges', badgeController.getAllBadges);

router.put('/badges/:badge_id', adminAuth, badgeController.updateBadge);

router.post('/badges/award', adminAuth, badgeController.awardBadge);

router.delete('/badges/:student_badge_id/revoke', adminAuth, badgeController.revokeBadge);

module.exports = router;