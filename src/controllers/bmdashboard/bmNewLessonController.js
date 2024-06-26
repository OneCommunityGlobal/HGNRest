const mongoose = require('mongoose');

const bmNewLessonController = function (BuildingNewLesson) {
    const buildingProject = require('../../models/bmdashboard/buildingProject');
    const Like = require('../../models/bmdashboard/buldingLessonLike');
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
            const newLesson = BuildingNewLesson.create(req.body)
            .then(result => res.status(201).send(result))
            .catch(error => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };
    const bmGetSingleLesson = async (req, res) => {
        const { lessonId } = req.params;
        try {
          const lesson = await BuildingNewLesson.findById(lessonId);

          if (!lesson) {
            return res.status(404).json({ error: 'Lesson not found' });
          }

          res.json(lesson);
        } catch (error) {
          console.error(`Error fetching lesson with ID ${lessonId}:`, error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      };
      const bmEditSingleLesson = async (req, res) => {
        const { requestorId } = req.body.requestor;
        const requestorRole = req.body.requestor.role;
        const { lessonId } = req.params;
        const updateData = req.body;
        const lesson = await BuildingNewLesson.findById(lessonId);
            // Extract only allowed fields (content, tag, relatedProject and title)
            const allowedFields = ['content', 'tags', 'relatedProject', 'title', 'allowedRoles', 'files'];
            const filteredUpdateData = Object.keys(updateData)
                .filter(key => allowedFields.includes(key))
                .reduce((obj, key) => {
                    obj[key] = updateData[key];
                    return obj;
                }, {});
                // uncomment below for auth

                // conditional that checks if user is lesson author or admin or exits
                // if(requestorId != lesson.author && requestorRole != "Administrator"){
                //   res.status(403).send({ message: 'You are not authorized to edit this record.' });
                //   return;
                // }
        try {
          const updatedLesson = await BuildingNewLesson.findByIdAndUpdate(lessonId, filteredUpdateData, { new: true });
          if (!updatedLesson) {
            return res.status(404).json({ error: 'Lesson not found' });
          }

          res.json(updatedLesson);
        } catch (error) {
          console.error(`Error updating lesson with ID ${req.params.lessonId}:`, error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      };
      const bmDeleteSingleLesson = async (req, res) => {
        const { requestorId } = req.body.requestor;
        const requestorRole = req.body.requestor.role;
        const { lessonId } = req.params;
        const lesson = await BuildingNewLesson.findById(lessonId);
        const projectId = lesson.relatedProject;
        const project = await buildingProject.findById(projectId);
        const bmId = project.buildingManager;
        // uncomment below for auth
        // logic for auth. If the user who is trying to delete is not the buildingManager or is not an Admin then return

        // if (bmId !== requestorId && requestorRole != "Administrator") {
        //   res.status(403).send({ message: 'You are not authorized to edit this record.' });
        //   return;
        // }

        try {
          const deletedLesson = await BuildingNewLesson.findByIdAndDelete(lessonId);

          if (!deletedLesson) {
            return res.status(404).json({ error: 'Lesson not found' });
          }

          res.json({ message: 'Lesson deleted successfully', deletedLesson });
        } catch (error) {
          console.error(`Error removing lesson with ID ${lessonId}:`, error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      };
      const likeLesson = async (req, res) => {
        const { lessonId } = req.params;
        const { userId } = req.body;

        try {
          const existingLike = await Like.findOne({ user: userId, lesson: lessonId });

          if (existingLike) {
            // User has already liked the lesson, handle unlike
            await Like.findByIdAndDelete(existingLike._id);
            await BuildingNewLesson.findByIdAndUpdate(lessonId, { $pull: { likes: existingLike._id } });

            // Decrement total likes count
            await BuildingNewLesson.findByIdAndUpdate(lessonId, { $inc: { totalLikes: -1 } });

            return res.status(200).json({ status: 'success', message: 'Lesson unliked successfully' });
          }

          // User has not liked the lesson, handle like
          const newLike = new Like({ user: userId, lesson: lessonId });
          await newLike.save();

          await BuildingNewLesson.findByIdAndUpdate(lessonId, { $push: { likes: newLike._id } });

          // Increment total likes count
          await BuildingNewLesson.findByIdAndUpdate(lessonId, { $inc: { totalLikes: 1 } });

          return res.status(200).json({ status: 'success', message: 'Lesson liked successfully' });
        } catch (error) {
          console.error('Error liking/unliking lesson:', error);
          return res.status(500).json({ status: 'error', message: 'Error liking/unliking lesson' });
        }
      };
    return {
 bmPostLessonList, bmGetLessonList, bmGetSingleLesson, bmDeleteSingleLesson, bmEditSingleLesson, likeLesson,
};
};

module.exports = bmNewLessonController;
