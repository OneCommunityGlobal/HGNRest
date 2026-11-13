const express = require('express');
const {
  getCalendarEvents,
  getCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEventStatus,
} = require('../../controllers/gardenManagement/gardenCalendarController');

const router = express.Router();

router.get('/', getCalendarEvents);

router.get('/:id', getCalendarEventById);

router.post('/', createCalendarEvent);

router.put('/:id', updateCalendarEvent);

router.delete('/:id', deleteCalendarEvent);

router.patch('/:id/status', updateCalendarEventStatus);

module.exports = router;
