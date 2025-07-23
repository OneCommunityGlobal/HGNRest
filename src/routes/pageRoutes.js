const express = require('express');
const router = express.Router();

// Import controllers
const pageController = require('../controllers/pageControllers');

router.get('/', pageController.getPages);
router.post('/post/link/:pageId', pageController.postLinkToPages);
router.post('/post/image/:pageId', pageController.postImageToPages);

module.exports = router;