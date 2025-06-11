const express = require('express');
const jobNotificationListControllers = require('../controllers/jobNotificationListControllers');

const router = express.Router();

router.get('/', jobNotificationListControllers.isOwner, jobNotificationListControllers.getJobWatchList);
router.post('/job', jobNotificationListControllers.isOwner, jobNotificationListControllers.addCCByJob);
router.post('/category', jobNotificationListControllers.isOwner, jobNotificationListControllers.addCCByCategory);
router.delete('/:id', jobNotificationListControllers.isOwner, jobNotificationListControllers.removeEmailFromCCList);

module.exports = router;