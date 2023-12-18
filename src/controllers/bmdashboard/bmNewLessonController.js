const mongoose = require('mongoose');

const bmNewLessonController = function (BuildingNewLesson) {
    const bmGetLessonList = async (req, res) => {
        try {
            BuildingNewLesson
            .find()
            // .populate()
            // .exec()
            .then(result => res.status(200).send(result))
            .catch(error => res.status(500).send(error));
            // res.status(200).send(newLessonList);
        } catch (err) {
            res.json(err);
        }
    };
    const bmPostLessonList = async (req, res) => {
        try {
            // get new lesson's title, content, tag, creating time, belongs-to-project-name, view-by-who
            // creating new lesson profile, add it into schema lessonList (wait to be create...)
            // using dummy data for now:
            // newLessonList.push(req.body);
            // res.status(200).send(newLessonList);
            console.log('this is post lesson controller');
        } catch (err) {
            res.json(err);
        }
    };
    return { bmPostLessonList, bmGetLessonList };
};

module.exports = bmNewLessonController;
