const EducationTask = require('../models/educationTask');
const LessonPlan = require('../models/lessonPlan');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');
const IntermediateTask = require('../models/intermediateTask');

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
      const { completedAt: currentCompletedAt } = task;
      const completedAt =
        status === 'completed' && task.status !== 'completed' ? new Date() : currentCompletedAt;

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

      const { completedAt: currentCompletedAt } = task;
      const completedAt =
        status === 'completed' && task.status !== 'completed' ? new Date() : currentCompletedAt;

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

  // Helper function to check and update parent task progress
  const checkAndUpdateParentTaskProgress = async (parentTaskId) => {
    try {
      // Get all intermediate tasks for this parent
      const intermediateTasks = await IntermediateTask.find({ parent_task_id: parentTaskId });

      // If there are no intermediate tasks, return
      if (intermediateTasks.length === 0) {
        return;
      }

      // Check if all intermediate tasks are completed
      const allCompleted = intermediateTasks.every((task) => task.status === 'completed');

      if (allCompleted) {
        // Get the parent task
        const parentTask = await EducationTask.findById(parentTaskId);

        // Only update if parent task is not already completed or graded
        if (parentTask && parentTask.status !== 'completed' && parentTask.status !== 'graded') {
          await EducationTask.findByIdAndUpdate(
            parentTaskId,
            {
              status: 'completed',
              completedAt: new Date(),
            },
            { new: true },
          );
        }
      }
    } catch (error) {
      console.error('Error updating parent task progress:', error);
    }
  };

  // Mark task as complete
  const markTaskAsComplete = async (req, res) => {
    try {
      const { taskId, studentId, taskType } = req.body;
      const requestorId = req.body.requestor?.requestorId;

      if (!taskId) {
        return res.status(400).json({ error: 'Task ID is required' });
      }

      if (!requestorId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Handle intermediate tasks
      if (taskType === 'intermediate') {
        const intermediateTask = await IntermediateTask.findById(taskId).populate('parent_task_id');

        if (!intermediateTask) {
          return res.status(404).json({ error: 'Intermediate task not found' });
        }

        // Check if task is already completed
        if (intermediateTask.status === 'completed') {
          return res.status(400).json({ error: 'Task is already completed' });
        }

        // Update intermediate task status to completed (only update status field)
        const updatedTask = await IntermediateTask.findByIdAndUpdate(
          taskId,
          {
            $set: { status: 'completed' },
          },
          { new: true, runValidators: true },
        ).populate('parent_task_id', 'type status dueAt studentId lessonPlanId');

        // Check if all intermediate tasks for the parent are completed
        await checkAndUpdateParentTaskProgress(intermediateTask.parent_task_id);

        return res.status(200).json({
          message: 'Intermediate task marked as complete successfully',
          task: updatedTask,
        });
      }

      // Handle education tasks (original logic)
      if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
      }

      // Find the task and verify it belongs to the student
      const task = await EducationTask.findOne({
        _id: taskId,
        studentId,
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found or does not belong to student' });
      }

      // Check if task is already completed
      if (task.status === 'completed') {
        return res.status(400).json({ error: 'Task is already completed' });
      }

      // Verify task type is read-only (only read-only tasks can be marked done manually)
      if (task.type !== 'read') {
        return res.status(400).json({
          error: 'Only read-only tasks can be marked as complete manually',
        });
      }

      // Check if logged hours meet the requirement
      if (task.loggedHours < task.suggestedTotalHours) {
        return res.status(400).json({
          error: `Insufficient hours logged. Required: ${task.suggestedTotalHours}, Logged: ${task.loggedHours}`,
        });
      }

      // Update task status to completed
      const updatedTask = await EducationTask.findByIdAndUpdate(
        taskId,
        {
          status: 'completed',
          completedAt: new Date(),
        },
        { new: true },
      )
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty');

      res.status(200).json({
        message: 'Task marked as complete successfully',
        task: updatedTask,
      });
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
    markTaskAsComplete,
  };
};

module.exports = educationTaskController;
