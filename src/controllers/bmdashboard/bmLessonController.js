

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
      
  
      // Assuming LessonList is your Mongoose model
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
  // TODO only make certain items editable? like not date
  const editSingleLesson = async (req, res) => {
    const { lessonId } = req.params;
    const updateData = req.body;
    try {
      
  
      // Assuming LessonList is your Mongoose model
      const updatedLesson = await BuildingLesson.findByIdAndUpdate(lessonId, updateData, { new: true });
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
      
  
      // Assuming LessonList is your Mongoose model
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
  return { fetchAllLessons, fetchSingleLesson, editSingleLesson , removeSingleLesson };
};

module.exports = bmLessonController;