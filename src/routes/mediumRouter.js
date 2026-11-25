const express = require('express');
const {
  getUserDetails,
  createPost,
  schedulePost,
  getPosts,
  deletePost,
  updatePost,
} = require('../controllers/mediumController');

const routes = function () {
  const mediumRouter = express.Router();

  mediumRouter.route('/medium/user').post(getUserDetails);
  mediumRouter.route('/medium/createPost').post(createPost);
  mediumRouter.route('/medium/schedulePost').post(schedulePost);
  mediumRouter.route('/medium/getPosts').get(getPosts);
  mediumRouter.route('/medium/deletePost').delete(deletePost);
  mediumRouter.route('/medium/updatePost').put(updatePost);

  return mediumRouter;
};

module.exports = routes;
