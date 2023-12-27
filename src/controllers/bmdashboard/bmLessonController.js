
const bmLessonController = function (BuildingLesson) {
  const buildingProject = require('../../models/bmdashboard/buildingProject');
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
    const requestorId = req.body.requestor.requestorId
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
  const editSingleLesson = async (req, res) => {
    const requestorId = req.body.requestor.requestorId
    const requestorRole = req.body.requestor.role
    const { lessonId } = req.params;
    const updateData = req.body;
    const lesson = await BuildingLesson.findById(lessonId);
        // Extract only allowed fields (content, tag, relatedProject and title)
        const allowedFields = ['content', 'tag', 'relatedProject', 'title'];
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
    const requestorId = req.body.requestor.requestorId
    const requestorRole = req.body.requestor.role
    const { lessonId } = req.params;
    const lesson = await BuildingLesson.findById(lessonId);
    const projectId = lesson.relatedProject
    const project = await buildingProject.findById(projectId);
    const bmId = project.buildingManager
    // uncomment below for auth
    // logic for auth. If the user who is trying to delete is not the buildingManager or is not an Admin then return
      
    // if (bmId !== requestorId && requestorRole != "Administrator") {
    //   res.status(403).send({ message: 'You are not authorized to edit this record.' });
    //   return;
    // }
   
   
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

  return { fetchAllLessons, fetchSingleLesson, editSingleLesson , removeSingleLesson };
};

module.exports = bmLessonController;