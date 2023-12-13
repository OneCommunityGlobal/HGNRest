const express = require('express');

const routes = function (buildingLesson) {
  const lessonRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmLessonController')(buildingLesson);

lessonRouter.route('/lessons')
  .get(controller.fetchAllLessons);

lessonRouter.route('/lesson/:lessonId')
  .get(controller.fetchSingleLesson)
  .put(controller.editSingleLesson)
  .delete(controller.removeSingleLesson);

  return lessonRouter;
};

module.exports = routes;