const express = require('express');

const router = function (title) {
  const controller = require('../controllers/titleController')(title);
  const titleRouter = express.Router();

  titleRouter.route('/title/order')
    .put(controller.updateTitlesOrder);

  titleRouter.route('/title/sorted')
    .get(controller.getAllTitles);

  titleRouter.route('/title/deleteAll')
    .get(controller.deleteAllTitles);

  titleRouter.route('/title/update')
    .post(controller.updateTitle);

  titleRouter.route('/title')
    .get(controller.getAllTitles)
    .post(controller.postTitle);

  titleRouter.route('/title/:titleId')
    .get(controller.getTitleById)
    .put(controller.deleteTitleById);

  return titleRouter;
};

module.exports = router;
