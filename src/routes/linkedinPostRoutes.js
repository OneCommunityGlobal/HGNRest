const express = require('express');

const router = express.Router();
const linkedinPostController = require('../controllers/linkedinPostController');

router.post('/postToLinkedIn', linkedinPostController.postToLinkedIn);

module.exports = router;
