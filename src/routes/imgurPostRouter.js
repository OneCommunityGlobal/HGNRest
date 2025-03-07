const express = require('express');
const multer = require('multer');

const upload = multer();

const routes = () => {
    // console.log("imgurPostRouter is loaded");

    const imgurPostController = require('../controllers/imgurPostController');
    const imgurRouter = express.Router();

    // console.log('received request: ', {
    //     body: imgurRouter.body,
    //     headers: imgurRouter.headers,
    //     method: imgurRouter.method,
    // })

    imgurRouter.route('/postToImgur').post(
        upload.single('image'),
        (req, res, next) => {
            // console.log('Received request to post to Imgur:', {
            //     body: req.body,
            //     image: req.file,
            // });
            next();
        },
        imgurPostController.postToImgur,
    );

    return imgurRouter;
}

module.exports = routes;