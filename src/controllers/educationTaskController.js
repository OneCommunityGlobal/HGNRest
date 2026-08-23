const mongoose = require('mongoose');
const EducationTask = require('../models/educationTask');
const LessonPlan = require('../models/lessonPlan');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');
const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');
const IntermediateTask = require('../models/intermediateTask');

const toObjectId = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!mongoose.Types.ObjectId.isValid(trimmed)) return null;
  return new mongoose.Types.ObjectId(trimmed);
};

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
   * Resolve target students from groupId or studentId
   */
  const resolveTargetStudents = async (groupId, studentId, userId) => {
    if (groupId) {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return { error: 'Invalid group ID', status: 400, students: [], groupName: null };
      }

      const validGroupId = new mongoose.Types.ObjectId(groupId);
      const group = await StudentGroup.findById(validGroupId);
      if (!group) {
        return { error: 'Group not found', status: 404, students: [], groupName: null };
      }

      if (group.educator_id.toString() !== userId) {
        return {
          error: 'Unauthorized to assign this group',
          status: 403,
          students: [],
          groupName: null,
        };
      }

      const members = await StudentGroupMember.find({ group_id: validGroupId }).select(
        'student_id',
      );
      const students = members.map((m) => m.student_id);

      if (!students.length) {
        return { error: 'No members in this group', status: 400, students: [], groupName: null };
      }

      return { students, groupName: group.name };
    }

    if (studentId) {
      const student = await UserProfile.findById(studentId);
      if (!student) {
        return { error: 'Student not found', status: 404, students: [], groupName: null };
      }
      return { students: [studentId], groupName: null };
    }

    return {
      error: 'Must provide studentId or groupId',
      status: 400,
      students: [],
      groupName: null,
    };
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

      // Validate type
      const validTaskTypes = ['read', 'write', 'practice', 'quiz', 'project'];
      if (!validTaskTypes.includes(type)) {
        return res
          .status(400)
          .json({ error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}` });
      }

      // Determine target students
      const result = await resolveTargetStudents(groupId, studentId, req.user);

      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }

      const { students: targetStudents, groupName } = result;

      // Validate atoms
      if (atomIds && atomIds.length > 0) {
        const atoms = await Atom.find({ _id: { $in: atomIds } });
        if (atoms.length !== atomIds.length) {
          return res.status(400).json({ error: 'One or more atoms not found' });
        }
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

      // Update completedAt if status is being changed to completed
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

  // Mark a student's task as completed from the student dashboard flow.
  const markTaskAsComplete = async (req, res) => {
    try {
      const { taskId, studentId } = req.body;

      if (!taskId || !studentId) {
        return res.status(400).json({ error: 'taskId and studentId are required' });
      }

      const safeTaskId = toObjectId(taskId);
      const safeStudentId = toObjectId(studentId);
      if (!safeTaskId || !safeStudentId) {
        return res.status(400).json({ error: 'Invalid taskId or studentId format' });
      }

      const task = await EducationTask.findOne({ _id: safeTaskId, studentId: safeStudentId });
      if (!task) {
        return res.status(404).json({ error: 'Task not found for this student' });
      }

      if (task.status === 'completed' || task.status === 'graded') {
        return res.status(200).json(task);
      }

      const updatedTask = await EducationTask.findByIdAndUpdate(
        safeTaskId,
        {
          status: 'completed',
          completedAt: new Date(),
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
      // Normalize the scale to a plain object. When it comes from the request
      // body it is already a plain object, but when it is read back from the DB
      // it is a Mongoose Map (which has no .toObject() and is not enumerable via
      // Object.entries), so convert it explicitly.
      let scale;
      if (gradeScale instanceof Map) {
        scale = Object.fromEntries(gradeScale);
      } else if (typeof gradeScale.toObject === 'function') {
        scale = gradeScale.toObject();
      } else {
        scale = gradeScale;
      }

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
        (req.body.requestor && req.body.requestor.requestorId);

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
  const getReviewSubmissions = async (req, res) => {
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

  const getTaskSubmissions = async (req, res) => {
    try {
      const {
        status,
        studentId,
        student_id: studentIdAlias,
        lessonPlanId,
        courseId,
        course_id: courseIdAlias,
      } = req.query;

      const filter = {};

      // Default to only educator-relevant statuses (completed = pending review, graded).
      if (status) {
        const statusMap = Object.freeze({
          submissions: 'completed',
          'pending submissions': 'assigned',
          pending: 'assigned',
          completed: 'completed',
          graded: 'graded',
          assigned: 'assigned',
          in_progress: 'in_progress',
        });
        const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
        const mappedStatus = statusMap[normalizedStatus];
        if (!mappedStatus) {
          return res.status(400).json({ error: 'Invalid status filter' });
        }
        filter.status = mappedStatus;
      } else {
        filter.status = { $in: ['completed', 'graded'] };
      }

      const rawStudentId = studentId || studentIdAlias;
      if (rawStudentId) {
        const safeStudentId = toObjectId(rawStudentId);
        if (!safeStudentId) {
          return res.status(400).json({ error: 'Invalid studentId filter' });
        }
        filter.studentId = safeStudentId;
      }

      // Accept `courseId` as an alias for lessonPlanId when frontend sends course filters.
      const lpFilterId = lessonPlanId || courseId || courseIdAlias;
      if (lpFilterId) {
        const safeLessonPlanId = toObjectId(lpFilterId);
        if (!safeLessonPlanId) {
          return res.status(400).json({ error: 'Invalid courseId filter' });
        }
        filter.lessonPlanId = safeLessonPlanId;
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
    getSubmissionForReview,
    updateSubmissionGrade,
    getReviewSubmissions,
    getTaskSubmissions,
    markTaskAsComplete,
  };
};

module.exports = educationTaskController;
