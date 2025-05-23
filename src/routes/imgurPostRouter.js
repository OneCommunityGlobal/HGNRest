const express = require('express');
const multer = require('multer');

const upload = multer();

const routes = () => {
    console.log("imgurPostRouter is loaded");

    const imgurPostController = require('../controllers/imgurPostController');
    const imgurRouter = express.Router();

    // imgurPostController.reloadScheduledPosts();

    // imgurRouter.route('/postToImgur').post(
    //     upload.array('image'),
    //     (req, res, next) => {

    //         if (req.body.scheduleTime) {
    //             const scheduledDateTime = new Date(req.body.scheduleTime);
    //             if (Number.isNaN(scheduledDateTime.getTime())) {
    //                 // If scheduleTime is invalid, delete it from the request body
    //                 delete req.body.scheduleTime;
    //             } else {
    //                 req.body.scheduleTime = scheduledDateTime;
    //             }
    //         } else {
    //             // If no schedule time is provided, remove the key from the request body
    //             delete req.body.scheduleTime;
    //         }


    //         req.files.forEach((file, index) => {
    //             file.description = req.body.description[index];
    //         })
    //         next();
    //     },
    //     imgurPostController.postToImgur,
    // );

    // imgurRouter.route('/scheduledPosts').get(imgurPostController.getScheduledPosts);
    // imgurRouter.route('/scheduledPosts/:jobId').delete(imgurPostController.deleteScheduledPost);
    // imgurRouter.route('/auth/imgur/callback').post(imgurPostController.authImgur);

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
    return imgurRouter;
}

module.exports = routes;