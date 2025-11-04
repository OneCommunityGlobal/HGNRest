const IntermediateTask = require('../models/intermediateTask');
const EducationTask = require('../models/educationTask');

const intermediateTaskController = function () {
  // Create new intermediate task
  const createIntermediateTask = async (req, res) => {
    try {
      const { parentTaskId, title, description, expectedHours, status, dueDate } = req.body;

      // Validate required fields
      if (!parentTaskId || !title) {
        return res.status(400).json({ error: 'parent_task_id and title are required' });
      }

      // Validate parent task exists
      const parentTask = await EducationTask.findById(parentTaskId);
      if (!parentTask) {
        return res.status(404).json({ error: 'Parent education task not found' });
      }

      // Validate status if provided
      if (status) {
        const validStatuses = ['pending', 'in_progress', 'completed'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          });
        }
      }

      const intermediateTask = new IntermediateTask({
        parent_task_id: parentTaskId,
        title,
        description,
        expected_hours: expectedHours || 0,
        status: status || 'pending',
        due_date: dueDate,
      });

      const savedTask = await intermediateTask.save();
      const populatedTask = await IntermediateTask.findById(savedTask._id).populate(
        'parent_task_id',
        'type status dueAt studentId lessonPlanId',
      );

      res.status(201).json(populatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get intermediate tasks for a parent task
  const getIntermediateTasksByParent = async (req, res) => {
    try {
      const { taskId } = req.params;

      // Validate parent task exists
      const parentTask = await EducationTask.findById(taskId);
      if (!parentTask) {
        return res.status(404).json({ error: 'Parent education task not found' });
      }

      const intermediateTasks = await IntermediateTask.find({ parent_task_id: taskId })
        .populate('parent_task_id', 'type status dueAt studentId lessonPlanId')
        .sort({ createdAt: 1 });

      res.status(200).json(intermediateTasks);
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

  // Update intermediate task
  const updateIntermediateTask = async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, expectedHours, status, dueDate } = req.body;

      // Find the intermediate task
      const intermediateTask = await IntermediateTask.findById(id);
      if (!intermediateTask) {
        return res.status(404).json({ error: 'Intermediate task not found' });
      }

      // Validate status if provided
      if (status) {
        const validStatuses = ['pending', 'in_progress', 'completed'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          });
        }
      }

      // Update the task
      const updatedTask = await IntermediateTask.findByIdAndUpdate(
        id,
        {
          title,
          description,
          expected_hours: expectedHours,
          status,
          due_date: dueDate,
        },
        { new: true, runValidators: true },
      ).populate('parent_task_id', 'type status dueAt studentId lessonPlanId');

      // Check if all intermediate tasks for the parent are completed
      if (status === 'completed') {
        await checkAndUpdateParentTaskProgress(intermediateTask.parent_task_id);
      }

      res.status(200).json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete intermediate task
  const deleteIntermediateTask = async (req, res) => {
    try {
      const { id } = req.params;

      const intermediateTask = await IntermediateTask.findByIdAndDelete(id);
      if (!intermediateTask) {
        return res.status(404).json({ error: 'Intermediate task not found' });
      }

      res.status(200).json({ message: 'Intermediate task deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    createIntermediateTask,
    getIntermediateTasksByParent,
    updateIntermediateTask,
    deleteIntermediateTask,
  };
};

module.exports = intermediateTaskController;
