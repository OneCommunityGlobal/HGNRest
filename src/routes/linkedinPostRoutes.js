// routes/linkedinPostRoutes.js
const express = require('express');

const router = express.Router();
const linkedinPostController = require('../controllers/linkedinPostController');

// routes to LinkedIn
router.post('/postToLinkedIn', linkedinPostController.postToLinkedIn);

module.exports = router;
