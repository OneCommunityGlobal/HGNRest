const express = require('express');
const router = express.Router();
const cors = require('cors');
const logger = require('../startup/logger');

router.use(cors());

const bloggerController = require('../controllers/bloggerController');

router.get('/status', bloggerController.checkStatus);
router.get('/auth', bloggerController.generateAuthUrl);
router.get('/google/callback', bloggerController.handleCallback);
router.post('/post', bloggerController.createPost);
router.get('/posts', bloggerController.getPosts);
router.put('/post/:postId', bloggerController.updatePost);
router.delete('/post/:postId', bloggerController.deletePost);

module.exports = router;
