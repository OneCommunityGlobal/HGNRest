const express = require('express');
const badgeController = require('../../controllers/educationPortal/badgeSystemController');
const {
  validateCreateBadge,
  validateUpdateBadge,
  validateAwardBadge,
  validateRevokeBadge,
  validateBadgeQuery,
  validateReason,
} = require('../../middleware/educationPortal/badgeValidation');

const router = express.Router();

router.get(
  '/student/badges',
  validateBadgeQuery,
  badgeController.getStudentBadges
);

router.get(
  '/student/badges/stats',
  badgeController.getStudentBadgeStats
);

router.get(
  '/student/badges/reason/:reason',
  validateReason,
  validateBadgeQuery,
  badgeController.getStudentBadgesByReason
);

router.post(
  '/badges',
  validateCreateBadge,
  badgeController.createBadge
);

router.get(
  '/badges',
  validateBadgeQuery,
  badgeController.getAllBadges
);

router.get(
  '/badges/leaderboard',
  badgeController.getBadgeLeaderboard
);

router.get(
  '/badges/:badge_id',
  badgeController.getBadgeById
);

router.put(
  '/badges/:badge_id',
  validateUpdateBadge,
  badgeController.updateBadge
);

router.delete(
  '/badges/:badge_id',
  badgeController.deleteBadge
);

router.post(
  '/badges/award',
  validateAwardBadge,
  badgeController.awardBadge
);

router.post(
  '/badges/award/bulk',
  badgeController.bulkAwardBadges
);

router.delete(
  '/badges/:student_badge_id/revoke',
  validateRevokeBadge,
  badgeController.revokeBadge
);

module.exports = router;