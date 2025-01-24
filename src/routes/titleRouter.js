const express = require('express');

const router = function (title) {
  const controller = require('../controllers/titleController')(title);
  const titleRouter = express.Router();

  titleRouter.route('/title')
    .get(controller.getAllTitles)
    .post(controller.postTitle)
  // .put(controller.putTitle);

  titleRouter.route('/title/update').post(controller.updateTitle);

  titleRouter.route('/title/:titleId')
    .get(controller.getTitleById)
    .put(controller.deleteTitleById);

  titleRouter.route('/title/deleteAll')
    .get(controller.deleteAllTitles);

  return titleRouter;
};

module.exports = router;
