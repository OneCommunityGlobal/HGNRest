const mongoose = require('mongoose');
const EducationTask = require('../models/educationTask');
const LessonPlan = require('../models/lessonPlan');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');

const educationTaskController = function () {
  // Get all education tasks
  const getEducationTasks = async (req, res) => {
    try {
      const tasks = await EducationTask.find({})
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(tasks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get tasks by student
  const getTasksByStudent = async (req, res) => {
    try {
      const { studentId } = req.params;
      const tasks = await EducationTask.find({ studentId })
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .sort({ dueAt: 1 });
      res.status(200).json(tasks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get tasks by lesson plan
  const getTasksByLessonPlan = async (req, res) => {
    try {
      const { lessonPlanId } = req.params;
      const tasks = await EducationTask.find({ lessonPlanId })
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .sort({ dueAt: 1 });
      res.status(200).json(tasks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get task by ID
  const getTaskById = async (req, res) => {
    try {
      const { id } = req.params;
      const task = await EducationTask.findById(id)
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty');
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      res.status(200).json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new task
  const createTask = async (req, res) => {
    try {
      const { 
        lessonPlanId, 
        studentId, 
        atomIds, 
        type, 
        dueAt 
      } = req.body;

      // Validate lesson plan exists
      const lessonPlan = await LessonPlan.findById(lessonPlanId);
      if (!lessonPlan) {
        return res.status(404).json({ error: 'Lesson plan not found' });
      }

      // Validate student exists
      const student = await UserProfile.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Validate atoms exist
      if (atomIds && atomIds.length > 0) {
        const atoms = await Atom.find({ _id: { $in: atomIds } });
        if (atoms.length !== atomIds.length) {
          return res.status(400).json({ error: 'One or more atoms not found' });
        }
      }

      // Validate task type
      const validTaskTypes = ['read', 'write', 'practice', 'quiz', 'project'];
      if (!validTaskTypes.includes(type)) {
        return res.status(400).json({ 
          error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}` 
        });
      }

      const task = new EducationTask({
        lessonPlanId,
        studentId,
        atomIds: atomIds || [],
        type,
        status: 'assigned',
        assignedAt: new Date(),
        dueAt,
        uploadUrls: [],
        grade: 'pending'
      });

      const savedTask = await task.save();
      const populatedTask = await EducationTask.findById(savedTask._id)
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty');

      res.status(201).json(populatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update task
  const updateTask = async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        atomIds, 
        type, 
        status, 
        dueAt, 
        uploadUrls, 
        grade, 
        feedback 
      } = req.body;

      const task = await EducationTask.findById(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Validate atoms exist if provided
      if (atomIds && atomIds.length > 0) {
        const atoms = await Atom.find({ _id: { $in: atomIds } });
        if (atoms.length !== atomIds.length) {
          return res.status(400).json({ error: 'One or more atoms not found' });
        }
      }

      // Validate task type if provided
      if (type) {
        const validTaskTypes = ['read', 'write', 'practice', 'quiz', 'project'];
        if (!validTaskTypes.includes(type)) {
          return res.status(400).json({ 
            error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}` 
          });
        }
      }

      // Validate status if provided
      if (status) {
        const validStatuses = ['assigned', 'in_progress', 'completed', 'graded'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ 
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
          });
        }
      }

      // Update completedAt if status is being changed to completed
      let completedAt = task.completedAt;
      if (status === 'completed' && task.status !== 'completed') {
        completedAt = new Date();
      }

      const updatedTask = await EducationTask.findByIdAndUpdate(
        id,
        { 
          atomIds, 
          type, 
          status, 
          dueAt, 
          uploadUrls, 
          grade, 
          feedback,
          completedAt
        },
        { new: true, runValidators: true }
      ).populate('lessonPlanId', 'title theme')
       .populate('studentId', 'firstName lastName email')
       .populate('atomIds', 'name description difficulty');

      res.status(200).json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete task
  const deleteTask = async (req, res) => {
    try {
      const { id } = req.params;

      const task = await EducationTask.findByIdAndDelete(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update task status
  const updateTaskStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const task = await EducationTask.findById(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const validStatuses = ['assigned', 'in_progress', 'completed', 'graded'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }

      let completedAt = task.completedAt;
      if (status === 'completed' && task.status !== 'completed') {
        completedAt = new Date();
      }

      const updatedTask = await EducationTask.findByIdAndUpdate(
        id,
        { status, completedAt },
        { new: true }
      ).populate('lessonPlanId', 'title theme')
       .populate('studentId', 'firstName lastName email')
       .populate('atomIds', 'name description difficulty');

      res.status(200).json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Grade task
  const gradeTask = async (req, res) => {
    try {
      const { id } = req.params;
      const { grade, feedback } = req.body;

      const task = await EducationTask.findById(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const validGrades = ['A', 'B', 'C', 'D', 'F', 'pending'];
      if (!validGrades.includes(grade)) {
        return res.status(400).json({ 
          error: `Invalid grade. Must be one of: ${validGrades.join(', ')}` 
        });
      }

      const updatedTask = await EducationTask.findByIdAndUpdate(
        id,
        { grade, feedback, status: 'graded' },
        { new: true }
      ).populate('lessonPlanId', 'title theme')
       .populate('studentId', 'firstName lastName email')
       .populate('atomIds', 'name description difficulty');

      res.status(200).json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get tasks by status
  const getTasksByStatus = async (req, res) => {
    try {
      const { status } = req.params;
      const tasks = await EducationTask.find({ status })
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .sort({ dueAt: 1 });
      res.status(200).json(tasks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getEducationTasks,
    getTasksByStudent,
    getTasksByLessonPlan,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    gradeTask,
    getTasksByStatus
  };
};

module.exports = educationTaskController; 