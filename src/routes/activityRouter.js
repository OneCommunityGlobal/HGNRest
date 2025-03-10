const express = require('express');

const router = express.Router();
const activityController = require('../controllers/activityController');

// Get activity details
router.get('/:activityId', activityController.getActivityById);

// Reschedule an activity
router.put('/:activityId/reschedule', activityController.rescheduleActivity);

module.exports = router;
