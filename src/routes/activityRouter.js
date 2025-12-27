const express = require('express');
const router = express.Router();

const {
  rescheduleNotify,
  getReschedulePoll,
  submitRescheduleVote,
} = require('../controllers/rescheduleEventContoller');

router.post('/:activityId/reschedule/notify', rescheduleNotify);
router.get('/:activityId/reschedule/poll', getReschedulePoll);
router.post('/:activityId/reschedule/vote', submitRescheduleVote);

module.exports = router;
