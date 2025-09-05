const express = require('express');
const router = express.Router();
const control = require('../controllers/activityController');

router.post('/activities/:activityId/reschedule/notify', control.rescheduleNotify);

module.exports = router;
