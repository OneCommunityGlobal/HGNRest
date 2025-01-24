const express = require('express');

const routes = function (buildingNewLesson) {
    const NewLessonRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmNewLessonController')(buildingNewLesson);

    // having GET request just for testing:
    NewLessonRouter.route('/lessons')
        .get(controller.bmGetLessonList);
    NewLessonRouter.route('/lesson/:lessonId')
        .get(controller.bmGetSingleLesson)
        .put(controller.bmEditSingleLesson)
        .delete(controller.bmDeleteSingleLesson);
    NewLessonRouter.route('/lessons/new')
        .post(controller.bmPostLessonList);
    NewLessonRouter.route('/lesson/:lessonId/like')
        .put(controller.likeLesson);
    NewLessonRouter.route('/tags')
        .get(controller.getLessonTags)
        .post(controller.addNewTag);
    NewLessonRouter.route('/tags/:tag')
        .delete(controller.deleteTag);


    return NewLessonRouter;
};
module.exports = routes;
