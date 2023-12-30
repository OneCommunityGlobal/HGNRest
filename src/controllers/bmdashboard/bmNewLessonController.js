const mongoose = require('mongoose');

const bmNewLessonController = function (BuildingNewLesson) {
    const bmGetLessonList = async (req, res) => {
        try {
            BuildingNewLesson
            .find()
            .populate()
            .then(result => res.status(200).send(result))
            .catch(error => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };
    const bmPostLessonList = async (req, res) => {
        try {
            const { id, title, content, author, tag, relatedProject} = req.body;
            const newLesson = BuildingNewLesson.create(req.body);
            newLesson.save().then(result => res.status(200).send(result))
            .catch(error => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };
    return { bmPostLessonList, bmGetLessonList };
};

module.exports = bmNewLessonController;
