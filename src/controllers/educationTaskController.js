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

  const getTaskSubmissions = async (req, res) => {
    try {
      const { status, studentId, lessonPlanId, courseId } = req.query;

      const filter = {};

      // Support friendly status values from frontend (e.g., "submissions", "pending submissions")
      // Map them to internal task statuses where applicable.
      if (status) {
        const statusMap = {
          submissions: 'completed',
          'pending submissions': 'assigned',
          pending: 'assigned',
          completed: 'completed',
          graded: 'graded',
        };
        filter.status = statusMap[status] || status;
      }
      if (studentId) {
        filter.studentId = studentId;
      }

      // Accept `courseId` as an alias for lessonPlanId when frontend sends course filters.
      const lpFilterId = lessonPlanId || courseId;
      if (lpFilterId) {
        filter.lessonPlanId = lpFilterId;
      }

      const submissions = await EducationTask.find(filter)
        .populate('studentId', 'firstName lastName email')
        .populate('lessonPlanId', 'title')
        .sort({ completedAt: -1 });

      // Helper function to format a single task submission
      const formatSubmission = (task) => {
        if (!task.studentId || !task.lessonPlanId) {
          return null;
        }

        // Detect late submission: when completedAt exists and is after dueAt
        let isLate = false;
        let lateByMs = 0;
        if (task.completedAt && task.dueAt) {
          const completed = new Date(task.completedAt).getTime();
          const due = new Date(task.dueAt).getTime();
          if (!Number.isNaN(completed) && !Number.isNaN(due) && completed > due) {
            isLate = true;
            lateByMs = completed - due;
          }
        }

        // If no completedAt but current time is past due and status not completed,
        // mark as overdue (not yet submitted) but not a "late submission".
        const now = Date.now();
        const isOverdue = !task.completedAt && task.dueAt && new Date(task.dueAt).getTime() < now;

        const camelStatus = (() => {
          if (task.status === 'completed') return 'Pending Review';
          if (task.status === 'graded') return 'Graded';
          return task.status;
        })();

        return {
          _id: task._id,
          studentId: task.studentId._id,

          // CamelCase fields expected by current frontend
          studentName: `${task.studentId.firstName} ${task.studentId.lastName}`,
          studentEmail: task.studentId.email,
          taskName: task.name || 'Unnamed Task',
          taskType: task.type,
          submissionLinks: task.uploadUrls || [],
          status: camelStatus,
          submittedAt: task.completedAt || null,
          assignedAt: task.assignedAt || null,
          dueAt: task.dueAt || null,
          grade: task.grade,
          feedback: task.feedback,
          lessonPlanId: task.lessonPlanId._id,
          lessonPlanTitle: task.lessonPlanId.title || 'Unknown Lesson Plan',
          late: isLate,
          lateByMs: isLate ? lateByMs : 0,
          overdue: isOverdue,

          // Backwards-compatible snake_case fields (some integrations may use these)
          student_name: `${task.studentId.firstName} ${task.studentId.lastName}`,
          student_email: task.studentId.email,
          task: task.name || 'Unnamed Task',
          task_type: task.type,
          submission_link: task.uploadUrls || [],
          submitted_at: task.completedAt || null,
          assigned_at: task.assignedAt || null,
          due_at: task.dueAt || null,
        };
      };

      const formattedSubmissions = submissions.map(formatSubmission).filter(Boolean);

      res.status(200).json(formattedSubmissions);
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
    getTaskSubmissions,
  };
};

module.exports = educationTaskController;
