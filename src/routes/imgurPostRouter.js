const express = require('express');
const multer = require('multer');

const upload = multer();

const routes = () => {
    console.log("imgurPostRouter is loaded");

    const imgurPostController = require('../controllers/imgurPostController');
    const imgurRouter = express.Router();

    imgurRouter.route('/imgur/auth').get(imgurPostController.getImgurAuthUrl);
    imgurRouter.route('/imgur/auth-callback').get(imgurPostController.handleImgurAuthCallback);
    imgurRouter.route('/imgur/store-token').post(imgurPostController.storeImgurToken);
    imgurRouter.route('/imgur/auth-status').get(imgurPostController.getImgurAuthStatus);
    imgurRouter.route('/imgur/disconnect').delete(imgurPostController.disconnectImgur);
    imgurRouter.route('/imgur/refresh-token').post(imgurPostController.refreshImgurToken);
    
    imgurRouter.route('/imgur/upload').post(upload.single('image'), imgurPostController.uploadImage);
    imgurRouter.route('/imgur/upload-to-gallery/:imageHash').post(imgurPostController.uploadImageToGallery)
    imgurRouter.route('/imgur/delete/:deleteHash').delete(imgurPostController.deleteImage);

    imgurRouter.route('/imgur/schedule-post').post(imgurPostController.scheduleImgurPost);
    imgurRouter.route('/imgur/scheduled-posts').get(imgurPostController.getImgurScheduledPosts)
    imgurRouter.route('/imgur/posts/:jobId').delete(imgurPostController.deleteImgurScheduledPost);
    return imgurRouter;
}

module.exports = routes;