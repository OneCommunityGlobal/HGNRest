

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
    try {
      const { lessonId } = req.params;
  
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
  

  return { fetchAllLessons, fetchSingleLesson };
};

module.exports = bmLessonController;