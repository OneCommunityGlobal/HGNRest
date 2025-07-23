const express = require('express');
const router = express.Router();

// Import controllers
const instagramController = require('../controllers/instagramControllers');

router.get('/', instagramController.getInstagramAccounts);
router.post('/post/image/:instagramId', instagramController.postImageToInstagram);

module.exports = router;