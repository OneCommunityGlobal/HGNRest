const mongoose = require('mongoose');
const lessonList = require('../../models/bmdashboard/buildingNewLesson');

// local dummy data just for testing:
// const newLessonList = [
//     {
//         id: '01',
//         title: 'lesson_1',
//         content: 'This is lesson_1 for manufacting.',
//         date: '2023-05-23',
//         author: 'james',
//         tag: 'manufacting',
//         project: ' project_1',
//     },

//     {
//         id: '02',
//         title: 'lesson_2',
//         content: 'This is lesson_2 for ui/ux design.',
//         date: '2022-06-12',
//         author: 'max',
//         tag: 'ui/ux',
//         project: ' project_2',
//     },

// ];

const bmNewLessonController = () => {
    const bmPostLessonList = async (req, res) => {
        try {
            // get new lesson's title, content, tag, creating time, belongs-to-project-name, view-by-who
            // creating new lesson profile, add it into schema lessonList (wait to be create...)
            // using dummy data for now:
            // newLessonList.push(req.body);
            // res.status(200).send(newLessonList);
        } catch (err) {
            res.json(err);
        }
    };
    const bmGetLessonList = async (req, res) => {
        try {
            const data = lessonList.find();
            console.log(data);
                // .then(result => res.status(200).send(result));
            // res.status(200).send(newLessonList);
        } catch (err) {
            res.json(err);
        }
    };
    return { bmPostLessonList, bmGetLessonList };
};
module.exports = bmNewLessonController;
