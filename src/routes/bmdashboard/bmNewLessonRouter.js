const express = require('express');

const routes = function (buildingNewLesson) {
    const NewLessonRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmNewLessonController')(buildingNewLesson);

    // having GET request just for testing:
    NewLessonRouter.route('/lessons')
        .get(controller.bmGetLessonList);

    NewLessonRouter.route('/lessons/new')
        .post(controller.bmPostLessonList);
    return NewLessonRouter;
};
module.exports = routes;
