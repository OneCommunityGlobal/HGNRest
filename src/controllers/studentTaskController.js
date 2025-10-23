const StudentTask = require('../models/studentTask');
const StudentAtom = require('../models/studentAtom');

const studentTaskController = function () {
  // Utility function to calculate deadline
  const calculateDeadline = (assignmentDate, offsetDays = 7) => {
    const deadline = new Date(assignmentDate);
    deadline.setDate(deadline.getDate() + offsetDays);
    return deadline;
  };

  // Create a new student task
  const createStudentTask = async (req, res) => {
    try {
      const {
        studentId,
        taskId,
        lessonPlanId,
        subject,
        colorLevel,
        activityGroup,
        teachingStrategy,
        lifeStrategy,
        isAutoAssigned,
        deadlineOffsetDays = 7,
      } = req.body;

      if (!studentId || !taskId || !lessonPlanId) {
        return res.status(400).json({
          error: 'studentId, taskId, and lessonPlanId are required',
        });
      }

      const assignment = new StudentTask({
        studentId,
        taskId,
        lessonPlanId,
        subject,
        colorLevel,
        activityGroup,
        teachingStrategy,
        lifeStrategy,
        isAutoAssigned,
        status: 'incomplete',
        assignment_timestamp: new Date(),
        deadline: calculateDeadline(new Date(), deadlineOffsetDays),
      });

      await assignment.save();

      res.status(201).json({
        message: 'Task assigned successfully',
        assignment,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Get all student tasks
  const getAllStudentTasks = async (req, res) => {
    try {
      const tasks = await StudentTask.find();
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Get tasks for a specific student
  const getTasksByStudent = async (req, res) => {
    try {
      const { studentId } = req.params;
      const tasks = await StudentTask.find({ studentId });
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Update task status
  const updateStudentTask = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const task = await StudentTask.findByIdAndUpdate(
        id,
        { status, updated_at: new Date() },
        { new: true },
      );

      if (!task) return res.status(404).json({ message: 'Task not found' });

      if (status === 'completed') {
        await StudentAtom.findOneAndUpdate(
          { studentId: task.studentId, atomId: task.taskId },
          { status: 'completed', updated_at: new Date(), completedAt: new Date() },
          { upsert: true, new: true },
        );
      }

      res.json({ message: 'Task updated successfully', task });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  return {
    createStudentTask,
    getAllStudentTasks,
    getTasksByStudent,
    updateStudentTask,
  };
};

module.exports = studentTaskController;
