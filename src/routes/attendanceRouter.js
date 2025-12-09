const express = require('express');
const attendanceController = require('../controllers/attendanceController');

const router = express.Router();
const controller = attendanceController();

router.post('/attendance', controller.createAttendanceLog);
router.get('/attendance/event/:eventId', controller.getAttendanceByEvent);
router.get('/attendance/event/:eventId/summary', controller.getAttendanceSummary);
router.post('/attendance/event/:eventId/seed', controller.seedAttendanceForEvent);
router.get('/attendance/event/:eventId/mock', controller.getMockAttendanceForEvent);
router.put('/attendance/:attendanceId', controller.updateAttendanceLog);
router.delete('/attendance/:attendanceId', controller.deleteAttendanceLog);

module.exports = router;
