const express = require('express');
const router = express.Router();

// Import controllers
const threadsController = require('../controllers/threadsControllers');

router.get('/login', threadsController.threadsLogin);
router.post('/updateSession', threadsController.updateSessionWithThreadsData);

router.get('/', threadsController.getThreadsAccount);

router.post('/post', threadsController.postToThreads);


module.exports = router;