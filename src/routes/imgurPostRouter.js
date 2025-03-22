const express = require('express');
const multer = require('multer');

const upload = multer();

const routes = () => {
    console.log("imgurPostRouter is loaded");

    const imgurPostController = require('../controllers/imgurPostController');
    const imgurRouter = express.Router();

    imgurPostController.reloadScheduledPosts();
    // console.log('received request: ', {
    //     body: imgurRouter.body,
    //     headers: imgurRouter.headers,
    //     method: imgurRouter.method,
    // })

    imgurRouter.route('/postToImgur').post(
        upload.array('image'),
        (req, res, next) => {
            console.log('Received request to post to Imgur:', {
                body: req.body,
                scheduleTime: req.body.scheduleTime,
                files: req.files?.map((file, index) => ({
                    originalname: file.originalname,
                    description: req.body.description[index],
                })),
            });

            if (req.body.scheduleTime) {
                const scheduledDateTime = new Date(req.body.scheduleTime);
                if (Number.isNaN(scheduledDateTime.getTime())) {
                    // If scheduleTime is invalid, delete it from the request body
                    delete req.body.scheduleTime;
                } else {
                    req.body.scheduleTime = scheduledDateTime;
                }
            } else {
                // If no schedule time is provided, remove the key from the request body
                delete req.body.scheduleTime;
            }

            console.log('Updated request body:', req.body);

            req.files.forEach((file, index) => {
                file.description = req.body.description[index];
            })
            next();
        },
        imgurPostController.postToImgur,
    );

    imgurRouter.route('/scheduledPosts').get(imgurPostController.getScheduledPosts);
    imgurRouter.route('/scheduledPosts/:jobId').delete(imgurPostController.deleteScheduledPost);

    // imgurRouter.route('/deleteScheduledPost/:jobId').delete(imgurPostController.deleteScheduledPost);

    return imgurRouter;
}

module.exports = routes;