const express = require('express');
// external dependency
const router = express.Router();
const tumblrController = require('../../controllers/autoPosters/tumblrController'); // local import

// Define routes
router.get('/posts', tumblrController.getAllPosts);
router.post('/post', tumblrController.postToBlog);
router.delete('/posts/:postId', tumblrController.deletePost);
router.get('/info', tumblrController.getProfileInfo);

module.exports = router;
