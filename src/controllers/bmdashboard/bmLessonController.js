const Like = require('../../models/bmdashboard/buildingLessonLike')
const bmLessonController = function (BuildingLesson) {
  const fetchAllLessons = async (req, res) => {
    try {
        BuildingLesson.find()
        .exec()
        .then(results => res.status(200).send(results))
        .catch(error => res.status(500).send(error));
      } catch (err) {
        res.json(err);
      }
  };

  const fetchSingleLesson = async (req, res) => {
    const { lessonId } = req.params;
    try {
      
      const lesson = await BuildingLesson.findById(lessonId);
  
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
  
      res.json(lesson);
    } catch (error) {
      console.error(`Error fetching lesson with ID ${lessonId}:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  // TODO add verify/conditional to check if user is the same user who made the lesson?
  const editSingleLesson = async (req, res) => {
    const { lessonId } = req.params;
    const updateData = req.body;
        // Extract only allowed fields (content, tag, relatedProject and title)
        const allowedFields = ['content', 'tag', 'relatedProject', 'title'];
        const filteredUpdateData = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updateData[key];
                return obj;
            }, {});
    try {
      
      const updatedLesson = await BuildingLesson.findByIdAndUpdate(lessonId, filteredUpdateData, { new: true });
      if (!updatedLesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
  
      res.json(updatedLesson);
    } catch (error) {
      console.error(`Error updating lesson with ID ${req.params.lessonId}:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  const removeSingleLesson = async (req, res) => {
    const { lessonId } = req.params;
    try {
      
      const deletedLesson = await BuildingLesson.findByIdAndDelete(lessonId);
  
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
console.log(userId,"here")
    try {
      const existingLike = await Like.findOne({ user: userId, lesson: lessonId });
  
      if (existingLike) {
        // User has already liked the lesson, handle unlike
        const deletedLike = await Like.findByIdAndDelete(existingLike._id);
        await BuildingLesson.findByIdAndUpdate(lessonId, { $pull: { likes: existingLike._id } });
  
        // Decrement total likes count
        await BuildingLesson.findByIdAndUpdate(lessonId, { $inc: { totalLikes: -1 } });
  
        return res.status(200).json({ status: 'success', message: 'Lesson unliked successfully' });
      }
  
      const newLike = new Like({ user: userId });
      await newLike.save();
  
      await BuildingLesson.findByIdAndUpdate(lessonId, { $push: { likes: newLike._id } });
  
      // Increment total likes count
      await BuildingLesson.findByIdAndUpdate(lessonId, { $inc: { totalLikes: 1 } });
  
      return res.status(200).json({ status: 'success', message: 'Lesson liked successfully' });
    } catch (error) {
      console.error('Error liking/unliking lesson:', error);
      return res.status(500).json({ status: 'error', message: 'Error liking/unliking lesson' });
    }
  };
  
  return { fetchAllLessons, fetchSingleLesson, editSingleLesson , removeSingleLesson, likeLesson };
};

module.exports = bmLessonController;