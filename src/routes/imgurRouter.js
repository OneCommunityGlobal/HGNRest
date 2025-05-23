const express = require('express');
const multer = require('multer');

const upload = multer();

const routes = () => {
    console.log('Imgur router loaded');

    const imgurController = require('../controllers/imgurController');
    const imgurRouter = express.Router();

    imgurRouter.route('/imgur/auth').get(imgurController.getImgurAuthUrl);
    imgurRouter.route('/imgur/auth-callback').get(imgurController.handleImgurAuthCallback);
    // imgurRouter.route('/imgur/auth-status').get(imgurController.getimgurAuthStatus);
    // imgurRouter.route('/imgur/disconnect').delete(imgurController.disconnectimgur);

    return imgurRouter;
}

module.exports = routes;