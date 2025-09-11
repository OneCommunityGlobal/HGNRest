const express = require('express');
const router = express.Router();

const {
  rescheduleNotify,
  voteReschedule,
} = require('../controllers/activityController');

router.post('/communityportal/activities/:activityId/reschedule/notify', rescheduleNotify);
router.get('/communityportal/activities/:activityId/reschedule/vote', voteReschedule);

module.exports = router;
