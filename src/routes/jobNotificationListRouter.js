const express = require('express');
const jobNotificationListControllers = require('../controllers/jobNotificationListControllers');

const router = express.Router();

router.get('/', jobNotificationListControllers.isOwner, jobNotificationListControllers.getJobWatchList);
router.post('/', jobNotificationListControllers.isOwner, jobNotificationListControllers.addEmailToCCList);
router.delete('/:id', jobNotificationListControllers.isOwner, jobNotificationListControllers.removeEmailFromCCList);

module.exports = router;