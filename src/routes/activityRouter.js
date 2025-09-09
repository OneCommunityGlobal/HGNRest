const express = require('express');
const router = express.Router();
const control = require('../controllers/activityController');

router.post('/:activityId/reschedule/notify', control.rescheduleNotify);

module.exports = router;
