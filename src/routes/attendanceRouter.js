const express = require('express');
const attendanceController = require('../controllers/attendanceController');

const router = express.Router();
const controller = attendanceController();
const authenticateHelpRequest = require('../middleware/authenticateHelpRequest');

const requireAttendanceManager = (req, res, next) => {
  const allowedRoles = ['Owner', 'Administrator'];

  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Access denied. Insufficient permissions.',
    });
  }

  next();
};

router.get('/attendance/event/:eventId', controller.getAttendanceByEvent);
router.get('/attendance/event/:eventId/summary', controller.getAttendanceSummary);
router.get('/attendance/event/:eventId/mock', controller.getMockAttendanceForEvent);
router.post(
  '/attendance',
  authenticateHelpRequest,
  requireAttendanceManager,
  controller.createAttendanceLog,
);

router.post(
  '/attendance/event/:eventId/seed',
  authenticateHelpRequest,
  requireAttendanceManager,
  controller.seedAttendanceForEvent,
);

router.put(
  '/attendance/:attendanceId',
  authenticateHelpRequest,
  requireAttendanceManager,
  controller.updateAttendanceLog,
);

router.delete(
  '/attendance/:attendanceId',
  authenticateHelpRequest,
  requireAttendanceManager,
  controller.deleteAttendanceLog,
);

module.exports = router;
