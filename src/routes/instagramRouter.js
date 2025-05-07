const express = require('express');
const multer = require('multer');

const upload = multer();

const routes = () => {
    console.log('Instagram router loaded');

    const instagramController = require('../controllers/instagramController');
    const instagramRouter = express.Router();

    // instagramRouter.route('/instagram').get(instagramController.getInstagram)
    // instagramRouter.route('/auth/instagram/callback').get(instagramController.getInstagramCallback)
    // instagramRouter.route('/instagram/exchange-token').post(instagramController.exchangeToken)

    instagramRouter.route('/instagram/access-token').post(instagramController.getInstagramShortLivedToken);
    instagramRouter.route('/instagram/long-lived-token').post(instagramController.getInstagramLongLivedToken);
    instagramRouter.route('/instagram/get-user-id').get(instagramController.getInstagramUserId);
    instagramRouter.route('/instagram/create-container').post(instagramController.createInstagramContainer);
    instagramRouter.route('/instagram/publish-container').post(instagramController.publishInstagramContainer);

    instagramRouter.route('/instagram/upload-imgur').post(
        upload.single('image'),
        instagramController.uploadImageToImgur
    );
    instagramRouter.route('/instagram/delete-imgur').delete(instagramController.deleteImageFromImgur);

    return instagramRouter;
}

module.exports = routes;