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
      const { lessonPlanId, studentId, atomIds, type, dueAt } = req.body;

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
          error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}`,
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
        grade: 'pending',
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
      const { atomIds, type, status, dueAt, uploadUrls, grade, feedback } = req.body;

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
            error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}`,
          });
        }
      }

      // Validate status if provided
      if (status) {
        const validStatuses = ['assigned', 'in_progress', 'completed', 'graded'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          });
        }
      }

      // Update completedAt if status is being changed to completed
      let { completedAt } = task;
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
          completedAt,
        },
        { new: true, runValidators: true },
      )
        .populate('lessonPlanId', 'title theme')
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
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }

      let { completedAt } = task;
      if (status === 'completed' && task.status !== 'completed') {
        completedAt = new Date();
      }

      const updatedTask = await EducationTask.findByIdAndUpdate(
        id,
        { status, completedAt },
        { new: true },
      )
        .populate('lessonPlanId', 'title theme')
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
          error: `Invalid grade. Must be one of: ${validGrades.join(', ')}`,
        });
      }

      const updatedTask = await EducationTask.findByIdAndUpdate(
        id,
        { grade, feedback, status: 'graded' },
        { new: true },
      )
        .populate('lessonPlanId', 'title theme')
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

  // Helper function to calculate grade from marks and grade scale
  const calculateGrade = (marks, maxMarks, gradeType, gradeScale) => {
    if (!marks || !maxMarks || marks < 0 || maxMarks <= 0) {
      return null;
    }

    const percentage = (marks / maxMarks) * 100;

    if (gradeType === 'numeric') {
      return percentage.toFixed(2);
    }

    // Letter grade calculation based on grade scale
    if (gradeScale && typeof gradeScale === 'object') {
      const scale = gradeScale.toObject ? gradeScale.toObject() : gradeScale;

      // Sort grade thresholds in descending order and find first match
      const sortedGrades = Object.entries(scale).sort((a, b) => b[1] - a[1]);

      const matchedGrade = sortedGrades.find((entry) => percentage >= entry[1]);
      if (matchedGrade) {
        return matchedGrade[0];
      }
    }

    // Default grade scale if none provided
    const defaultScale = {
      A: 90,
      B: 80,
      C: 70,
      D: 60,
      F: 0,
    };

    const defaultMatchedGrade = Object.entries(defaultScale)
      .sort((a, b) => b[1] - a[1])
      .find((entry) => percentage >= entry[1]);

    if (defaultMatchedGrade) {
      return defaultMatchedGrade[0];
    }

    return 'F';
  };

  // Get submission for review (GET /educator/review/:submissionId)
  const getSubmissionForReview = async (req, res) => {
    try {
      const { submissionId } = req.params;

      const task = await EducationTask.findById(submissionId)
        .populate({
          path: 'lessonPlanId',
          select: 'title theme',
          strictPopulate: false,
        })
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .populate('educatorId', 'firstName lastName email');

      if (!task) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      res.status(200).json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update or publish grade (POST /educator/review/:submissionId)
  const updateSubmissionGrade = async (req, res) => {
    try {
      const { submissionId } = req.params;
      const {
        marks,
        maxMarks,
        gradeType,
        gradeScale,
        feedback,
        action, // 'update' or 'publish'
      } = req.body;

      // Get educator ID from request (assuming it's in req.user or req.body)
      const educatorId =
        req.body.educatorId ||
        (req.user && req.user._id) ||
        (req.body.requestor && req.body.requestor.userId);

      const task = await EducationTask.findById(submissionId);
      if (!task) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      // Prepare update object
      const updateData = {};

      // Update marks if provided
      if (marks !== undefined) {
        updateData.marks = marks;
      }
      if (maxMarks !== undefined) {
        updateData.maxMarks = maxMarks;
      }
      if (gradeType) {
        updateData.gradeType = gradeType;
      }
      if (gradeScale) {
        updateData.gradeScale = gradeScale;
      }
      if (feedback !== undefined) {
        updateData.feedback = feedback;
      }
      if (educatorId) {
        updateData.educatorId = educatorId;
      }

      // Calculate grade if marks are provided
      const finalMarks = marks !== undefined ? marks : task.marks;
      const finalMaxMarks = maxMarks !== undefined ? maxMarks : task.maxMarks;
      const finalGradeType = gradeType || task.gradeType || 'letter';
      const finalGradeScale = gradeScale || task.gradeScale;

      if (finalMarks !== undefined && finalMaxMarks !== undefined) {
        const calculatedGrade = calculateGrade(
          finalMarks,
          finalMaxMarks,
          finalGradeType,
          finalGradeScale,
        );
        if (calculatedGrade !== null) {
          updateData.grade = calculatedGrade;
        }
      }

      // Handle action: update or publish
      if (action === 'update') {
        updateData.submissionStatus = 'Grade Updated';
        updateData.gradeUpdatedAt = new Date();
      } else if (action === 'publish') {
        updateData.submissionStatus = 'Grade Posted';
        updateData.gradePostedAt = new Date();
        // Also set gradeUpdatedAt if not already set
        if (!task.gradeUpdatedAt) {
          updateData.gradeUpdatedAt = new Date();
        }
      }

      // If status should be updated to 'graded' when grade is posted
      if (action === 'publish' && updateData.grade && updateData.grade !== 'pending') {
        updateData.status = 'graded';
      }

      const updatedTask = await EducationTask.findByIdAndUpdate(submissionId, updateData, {
        new: true,
        runValidators: true,
      })
        .populate({
          path: 'lessonPlanId',
          select: 'title theme',
          strictPopulate: false,
        })
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .populate('educatorId', 'firstName lastName email');

      res.status(200).json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get submissions for educator review (GET /educator/task-submissions)
  const getTaskSubmissions = async (req, res) => {
    try {
      const { lessonPlanId, status, submissionStatus } = req.query;

      const query = {};
      if (lessonPlanId) {
        query.lessonPlanId = lessonPlanId;
      }
      if (status) {
        query.status = status;
      }
      if (submissionStatus) {
        query.submissionStatus = submissionStatus;
      }

      // Get completed or submitted tasks
      query.$or = [
        { status: 'completed' },
        { submissionStatus: { $in: ['Submitted', 'Grade Updated', 'Grade Posted'] } },
      ];

      const tasks = await EducationTask.find(query)
        .populate({
          path: 'lessonPlanId',
          select: 'title theme',
          strictPopulate: false,
        })
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .populate('educatorId', 'firstName lastName email')
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
    getTasksByStatus,
    getSubmissionForReview,
    updateSubmissionGrade,
    getTaskSubmissions,
  };
};

module.exports = educationTaskController;
