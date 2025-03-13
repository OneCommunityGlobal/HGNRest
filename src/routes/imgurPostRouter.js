const express = require('express');
const multer = require('multer');

const upload = multer();

const routes = () => {
    console.log("imgurPostRouter is loaded");

    const imgurPostController = require('../controllers/imgurPostController');
    const imgurRouter = express.Router();

    // console.log('received request: ', {
    //     body: imgurRouter.body,
    //     headers: imgurRouter.headers,
    //     method: imgurRouter.method,
    // })

    imgurRouter.route('/postToImgur').post(
        upload.array('image'),
        // upload.single('image'),
        (req, res, next) => {
            console.log('Received request to post to Imgur:', {
                body: req.body,
                scheduleTime: req.body.scheduleTime,
                files: req.files?.map((file) => ({
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                })),
            });
            next();
        },
        imgurPostController.postToImgur,
    );

    return imgurRouter;
}

module.exports = routes;