const express = require('express');
// const multer = require('multer');

// const upload = multer();

const routes = () => {
    console.log('Instagram router loaded');

    const instagramController = require('../controllers/instagramController');
    const instagramRouter = express.Router();

    instagramRouter.route('/instagram').get(instagramController.getInstagram)
    instagramRouter.route('/auth/instagram/callback').get(instagramController.getInstagramCallback)
    instagramRouter.route('/instagram/exchange-token').post(instagramController.exchangeToken)
    

    return instagramRouter;
}

module.exports = routes;