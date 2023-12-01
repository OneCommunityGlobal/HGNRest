const express = require('express');

const router = function (title) {
  const controller = require('../controllers/titleController')(title);

  const titleRouter = express.Router();

  titleRouter.route('/title')
    .get(controller.getAllTitles)
    .post(controller.postTitle);

  titleRouter.route('/title/:titleId')
    .get(controller.getTitleById);

  return titleRouter;
};

module.exports = router;
