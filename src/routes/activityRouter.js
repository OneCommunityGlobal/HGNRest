const express = require('express');
const router = express.Router();

const {
  rescheduleNotify,
  voteReschedule,
} = require('../controllers/activityController');

router.post('/:activityId/reschedule/notify', rescheduleNotify);
router.get('/:activityId/reschedule/vote', voteReschedule);

module.exports = router;
