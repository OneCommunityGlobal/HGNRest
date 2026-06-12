const express = require('express');
const badgeController = require('../../controllers/educationPortal/badgeSystemController');
const {
  validateCreateBadge,
  validateUpdateBadge,
  validateAwardBadge,
  validateRevokeBadge,
  validateBadgeQuery,
  validateReason,
  validateDeleteBadge,
} = require('../../middleware/educationPortal/badgeValidation');

const router = express.Router();

// Student badge routes
router.get('/student/badges', validateBadgeQuery, badgeController.getStudentBadges);

router.get('/student/badges/stats', badgeController.getStudentBadgeStats);

router.post(
  '/student/badges/reason',
  validateReason,
  validateBadgeQuery,
  badgeController.getStudentBadgesByReason,
);

// Badge CRUD routes
router.post('/badges', validateCreateBadge, badgeController.createBadge);

router.get('/badges/leaderboard', badgeController.getBadgeLeaderboard);

router.post('/badges/award', validateAwardBadge, badgeController.awardBadge);

router.post('/badges/award/bulk', badgeController.bulkAwardBadges);

router.post('/badges/revoke', validateRevokeBadge, badgeController.revokeBadge);

router.get('/badges', validateBadgeQuery, badgeController.getAllBadges);

router.post('/badges/get', badgeController.getBadgeById);

router.put('/badges', validateUpdateBadge, badgeController.updateBadge);

router.post('/badges/delete', validateDeleteBadge, badgeController.deleteBadge);

module.exports = router;
