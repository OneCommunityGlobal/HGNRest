const express = require('express');
const multer = require('multer');

const upload = multer();

const routes = () => {
    console.log('Instagram router loaded');

    const instagramController = require('../controllers/instagramController');
    const instagramRouter = express.Router();

    // Instagram Authentication
    instagramRouter.route('/instagram/auth').get(instagramController.getInstagramAuthUrl);
    instagramRouter.route('/instagram/auth-callback').get(instagramController.handleInstagramAuthCallback);
    instagramRouter.route('/instagram/auth-status').get(instagramController.getInstagramAuthStatus);
    instagramRouter.route('/instagram/disconnect').delete(instagramController.disconnectInstagram);

    // Instagram Posting
    instagramRouter.route('/instagram/get-user-id').get(instagramController.getInstagramUserId);
    instagramRouter.route('/instagram/create-container').post(instagramController.createInstagramContainer);
    instagramRouter.route('/instagram/publish-container').post(instagramController.publishInstagramContainer);

    // Imgur helper for Instagram
    instagramRouter.route('/instagram/upload-imgur').post(
        upload.single('image'),
        instagramController.uploadImageToImgur
    );
    instagramRouter.route('/instagram/delete-imgur').delete(instagramController.deleteImageFromImgur);

    // Instagram scheduling
    instagramRouter.route('/instagram/schedule-post').post(instagramController.scheduleInstagramPost);
    instagramRouter.route('/instagram/posts/:jobId').delete(instagramController.deleteInstagramPostByJobId);
    instagramRouter.route('/instagram/posts').get(instagramController.getAllInstagramPosts);

    return instagramRouter;
}

module.exports = routes;