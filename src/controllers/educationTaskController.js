const EducationTask = require('../models/educationTask');
const LessonPlan = require('../models/lessonPlan');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');
const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');

const educationTaskController = () => {
  /**
   * Get all education tasks (admin/educator)
   */
  const getEducationTasks = async (req, res) => {
    try {
      const tasks = await EducationTask.find({})
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .sort({ createdAt: -1 });

      res.status(200).json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Get tasks by student ID
   */
  const getTasksByStudent = async (req, res) => {
    try {
      const { studentId } = req.params;

      const tasks = await EducationTask.find({ studentId })
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .sort({ dueAt: 1 });

      res.status(200).json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Get tasks by lesson plan ID
   */
  const getTasksByLessonPlan = async (req, res) => {
    try {
      const { lessonPlanId } = req.params;

      const tasks = await EducationTask.find({ lessonPlanId })
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .sort({ dueAt: 1 });

      res.status(200).json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Get a task by its ID
   */
  const getTaskById = async (req, res) => {
    try {
      const { id } = req.params;
      const task = await EducationTask.findById(id)
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty');

      if (!task) return res.status(404).json({ error: 'Task not found' });

      res.status(200).json(task);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Create tasks (single student or group)
   */
  const createTask = async (req, res) => {
    try {
      const { lessonPlanId, studentId, groupId, atomIds, type, dueAt } = req.body;

      // Validate lesson plan
      const lessonPlan = await LessonPlan.findById(lessonPlanId);
      if (!lessonPlan) return res.status(404).json({ error: 'Lesson plan not found' });

      // Determine target students
      let targetStudents = [];
      let groupName;

      if (groupId) {
        const group = await StudentGroup.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Authorization: educator owns group
        if (group.educator_id.toString() !== req.user) {
          return res.status(403).json({ error: 'Unauthorized to assign this group' });
        }

        const members = await StudentGroupMember.find({ group_id: groupId }).select('student_id');
        targetStudents = members.map((m) => m.student_id);

        if (!targetStudents.length) {
          return res.status(400).json({ error: 'No members in this group' });
        }

        groupName = group.name;
      } else if (studentId) {
        const student = await UserProfile.findById(studentId);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        targetStudents = [studentId];
      } else {
        return res.status(400).json({ error: 'Must provide studentId or groupId' });
      }

      // Validate atoms
      if (atomIds && atomIds.length > 0) {
        const atoms = await Atom.find({ _id: { $in: atomIds } });
        if (atoms.length !== atomIds.length) {
          return res.status(400).json({ error: 'One or more atoms not found' });
        }
      }

      // Validate type
      const validTaskTypes = ['read', 'write', 'practice', 'quiz', 'project'];
      if (!validTaskTypes.includes(type)) {
        return res
          .status(400)
          .json({ error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}` });
      }

      // Insert tasks
      const tasksToInsert = targetStudents.map((id) => ({
        lessonPlanId,
        studentId: id,
        atomIds: atomIds || [],
        type,
        status: 'assigned',
        assignedAt: new Date(),
        dueAt,
        uploadUrls: [],
        grade: 'pending',
      }));

      const createdTasks = await EducationTask.insertMany(tasksToInsert);

      const populatedTasks = await EducationTask.find({
        _id: { $in: createdTasks.map((t) => t._id) },
      })
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty');

      res.status(201).json({
        message: 'Tasks created successfully',
        tasks: populatedTasks,
        group_name: groupName,
      });
    } catch (err) {
      console.error('Error creating tasks:', err);
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Update a task
   */
  const updateTask = async (req, res) => {
    try {
      const { id } = req.params;
      const { atomIds, type, status, dueAt, uploadUrls, grade, feedback } = req.body;

      const task = await EducationTask.findById(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // Validate atoms
      if (atomIds && atomIds.length > 0) {
        const atoms = await Atom.find({ _id: { $in: atomIds } });
        if (atoms.length !== atomIds.length) {
          return res.status(400).json({ error: 'One or more atoms not found' });
        }
      }

      // Validate type
      if (type) {
        const validTaskTypes = ['read', 'write', 'practice', 'quiz', 'project'];
        if (!validTaskTypes.includes(type)) {
          return res
            .status(400)
            .json({ error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}` });
        }
      }

      // Validate status
      if (status) {
        const validStatuses = ['assigned', 'in_progress', 'completed', 'graded'];
        if (!validStatuses.includes(status)) {
          return res
            .status(400)
            .json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }
      }

      let { completedAt } = task;
      if (status === 'completed' && task.status !== 'completed') {
        completedAt = new Date();
      }

      const updatedTask = await EducationTask.findByIdAndUpdate(
        id,
        { atomIds, type, status, dueAt, uploadUrls, grade, feedback, completedAt },
        { new: true, runValidators: true },
      )
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty');

      res.status(200).json(updatedTask);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Delete a task
   */
  const deleteTask = async (req, res) => {
    try {
      const { id } = req.params;
      const task = await EducationTask.findByIdAndDelete(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      res.status(200).json({ message: 'Task deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Update task status
   */
  const updateTaskStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const task = await EducationTask.findById(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const validStatuses = ['assigned', 'in_progress', 'completed', 'graded'];
      if (!validStatuses.includes(status)) {
        return res
          .status(400)
          .json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Grade a task
   */
  const gradeTask = async (req, res) => {
    try {
      const { id } = req.params;
      const { grade, feedback } = req.body;

      const task = await EducationTask.findById(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const validGrades = ['A', 'B', 'C', 'D', 'F', 'pending'];
      if (!validGrades.includes(grade)) {
        return res
          .status(400)
          .json({ error: `Invalid grade. Must be one of: ${validGrades.join(', ')}` });
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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Get tasks by status
   */
  const getTasksByStatus = async (req, res) => {
    try {
      const { status } = req.params;

      const tasks = await EducationTask.find({ status })
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty')
        .sort({ dueAt: 1 });

      res.status(200).json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
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
  };
};

module.exports = educationTaskController;
