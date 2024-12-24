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

      const addNewTag = async (req, res) => {
        try {
          const { tag } = req.body;
          
          if (!tag || typeof tag !== 'string') {
            return res.status(400).json({ error: 'Invalid tag format' });
          }
      
          // Check if tag already exists
          const existingLesson = await BuildingNewLesson.findOne({ tags: tag });
          
          if (!existingLesson) {
            await BuildingNewLesson.create({
              title: 'Tag Storage',
              content: 'Tag Storage Entry',
              tags: [tag],
              author: '000000000000000000000000',
              relatedProject: '000000000000000000000000',
              allowedRoles: 'All'
            });
          }
          console.log("tag created");
          // Get updated tags list
          const tags = await BuildingNewLesson.getAllTags();
          return res.status(201).json(tags);
      
        } catch (error) {
          console.error('Tag creation error:', error);
          return res.status(500).json({ 
            error: 'Error adding new tag',
            details: error.message 
          });
        }
      };

      const deleteTag = async (req, res) => {
        try {
          const tagToDelete = req.params.tag;
          
          if (!tagToDelete) {
            return res.status(400).json({ error: 'Tag parameter is required' });
          }
      
          // Update all lessons that contain the tag using updateMany
          await BuildingNewLesson.updateMany(
            { tags: tagToDelete },
            { $pull: { tags: tagToDelete } }
          );
      
          // Delete any empty tag storage documents
          await BuildingNewLesson.deleteMany({
            title: 'Tag Storage',
            tags: { $size: 0 }
          });
      
          const remainingTags = await BuildingNewLesson.getAllTags();
          return res.status(200).json(remainingTags);
          
        } catch (error) {
          console.error('Delete tag error:', error);
          return res.status(500).json({ 
            error: 'Error deleting tag',
            details: error.message 
          });
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
      const getLessonTags = async (req, res) => {
        try {
            const lessons = await BuildingNewLesson.find({}, 'tags');
            const allTags = lessons.reduce((acc, lesson) => [...acc, ...lesson.tags], []);
            const uniqueTags = [...new Set(allTags)].sort();
            res.status(200).json(uniqueTags);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching tags' });
        }
    };
    return {
 bmPostLessonList, bmGetLessonList, bmGetSingleLesson, bmDeleteSingleLesson, bmEditSingleLesson, likeLesson, getLessonTags, addNewTag, deleteTag
};
};

module.exports = bmNewLessonController;
