const express = require('express');

const routes = function (buildingNewLesson) {
    const NewLessonRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmNewLessonController')(buildingNewLesson);

    // having GET request just for testing:
    NewLessonRouter.route('/getnewlesson')
        .get(controller.bmGetLessonList);

    NewLessonRouter.route('/postnewlesson')
        .post(controller.bmPostLessonList);
    return NewLessonRouter;
};
module.exports = routes;
