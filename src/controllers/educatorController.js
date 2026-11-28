const mongoose = require('mongoose');
const LessonPlan = require('../models/lessonPlan');
const Activity = require('../models/activity');
const EducationTask = require('../models/educationTask');
const Progress = require('../models/progress');
const Atom = require('../models/atom');
const UserProfile = require('../models/userProfile');
const StudentAtom = require('../models/studentAtom');
const evaluationResultsService = require('../services/studentEvaluationResultsService');

const validRoles = [
  'admin',
  'educator',
  'Educator',
  'teacher',
  'Teacher',
  'owner',
  'Owner',
  'Administrator',
];

const hasEducatorAccess = (requestor) =>
  !!requestor && !!requestor.requestorId && validRoles.includes(requestor.role);

const validateAssignAtomsRequest = (req, res) => {
  const { requestor } = req.body;
  const { studentId, atomType, atomTypes } = req.body;

  if (!requestor?.requestorId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  if (!validRoles.includes(requestor.role)) {
    res.status(403).json({
      error: 'Insufficient permissions. Educator, admin, teacher, or owner role required.',
      receivedRole: requestor.role,
      validRoles,
    });
    return null;
  }

  if (!studentId) {
    res.status(400).json({ error: 'student_id is required' });
    return null;
  }

  let atomIds = [];
  if (atomTypes && Array.isArray(atomTypes)) {
    atomIds = atomTypes;
  } else if (atomType) {
    atomIds = [atomType];
  } else {
    res.status(400).json({ error: 'atom_type or atom_types array is required' });
    return null;
  }

  return { requestor, studentId, atomIds, note: req.body.note };
};

const validateStudentAndAtoms = async (studentId, atomIds, res) => {
  const student = await UserProfile.findById(studentId);
  if (!student) {
    res.status(404).json({
      error: 'Student not found',
      studentId,
      message: 'Please check if the student ID exists in the database',
    });
    return null;
  }

  const atoms = await Atom.find({ _id: { $in: atomIds } });
  const foundAtomIds = atoms.map((atom) => atom._id.toString());
  const missingAtomIds = atomIds.filter((id) => !foundAtomIds.includes(id.toString()));

  if (missingAtomIds.length > 0) {
    res.status(404).json({
      error: 'One or more atoms not found',
      missingAtomIds,
      message: 'Please check if all atom IDs exist in the database',
    });
    return null;
  }

  return { student, atoms };
};

const checkExistingAssignments = async (studentId, atomIds) => {
  const existingAssignments = await StudentAtom.find({
    studentId,
    atomId: { $in: atomIds },
  });

  const alreadyAssignedAtomIds = existingAssignments.map((assignment) =>
    assignment.atomId.toString(),
  );
  const newAtomIds = atomIds.filter((id) => !alreadyAssignedAtomIds.includes(id.toString()));

  return { alreadyAssignedAtomIds, newAtomIds };
};

const createAssignments = (studentId, newAtomIds, requestorId, note) => {
  const assignmentsToCreate = newAtomIds.map((atomId) => ({
    studentId,
    atomId,
    assignedBy: requestorId,
    note: note || undefined,
  }));

  return StudentAtom.insertMany(assignmentsToCreate);
};

const buildAssignAtomsResponse = async (savedAssignments, atomIds, alreadyAssignedAtomIds) => {
  const populatedAssignments = await StudentAtom.find({
    _id: { $in: savedAssignments.map((a) => a._id) },
  })
    .populate('studentId', 'firstName lastName email')
    .populate('atomId', 'name description difficulty')
    .populate('assignedBy', 'firstName lastName email');

  const response = {
    message: 'Atom assignments processed',
    successfulAssignments: populatedAssignments,
    totalRequested: atomIds.length,
    successfullyAssigned: savedAssignments.length,
    alreadyAssigned: alreadyAssignedAtomIds.length,
  };

  if (alreadyAssignedAtomIds.length > 0) {
    response.alreadyAssignedAtomIds = alreadyAssignedAtomIds;
    response.message += ` (${alreadyAssignedAtomIds.length} were already assigned)`;
  }

  return response;
};

const educatorController = function () {
  // Utility function to calculate deadline
  const calculateDeadline = (assignmentDate, offsetDays = 7) => {
    const deadline = new Date(assignmentDate);
    deadline.setDate(deadline.getDate() + offsetDays);
    return deadline;
  };

  // Check if student has completed prerequisite atoms
  const checkPrerequisites = async (studentId, atomId) => {
    try {
      const atom = await Atom.findById(atomId).populate('prerequisites');
      if (!atom || !atom.prerequisites || atom.prerequisites.length === 0) {
        return true; // No prerequisites required
      }

      // Check if student has completed all prerequisite atoms
      const prerequisiteIds = atom.prerequisites.map((prereq) => prereq._id);
      const completedProgress = await Progress.find({
        studentId,
        atomId: { $in: prerequisiteIds },
        status: 'completed',
      });

      return completedProgress.length === prerequisiteIds.length;
    } catch (error) {
      throw new Error(`Error checking prerequisites: ${error.message}`);
    }
  };

  // Get enrolled students (those with student education profile)
  const getEnrolledStudents = async () => {
    try {
      return await UserProfile.find({
        'educationProfiles.student.cohortId': { $exists: true },
        isActive: true,
      }).select('_id firstName lastName email educationProfiles.student');
    } catch (error) {
      throw new Error(`Error fetching enrolled students: ${error.message}`);
    }
  };

  // Main assignment endpoint
  const assignTasks = async (req, res) => {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const {
        lesson_plan_id: lessonPlanId,
        assignment_date: assignmentDate,
        is_auto_assigned: isAutoAssigned,
        deadline_offset_days: deadlineOffsetDays,
      } = req.body;

      // Validate required fields
      if (!lessonPlanId || !assignmentDate) {
        return res.status(400).json({
          error: 'lesson_plan_id and assignment_date are required',
        });
      }

      // Validate lesson plan exists
      const lessonPlan = await LessonPlan.findById(lessonPlanId)
        .populate('activities')
        .session(session);

      if (!lessonPlan) {
        return res.status(404).json({
          error: 'Lesson plan not found',
        });
      }

      // Get activities and extract task templates
      const activities = await Activity.find({
        lessonPlanId,
      }).session(session);

      if (!activities || activities.length === 0) {
        return res.status(400).json({
          error: 'No activities found for this lesson plan',
        });
      }

      // Extract all atom task templates from activities
      const taskTemplates = [];
      activities.forEach((activity) => {
        activity.atomTaskTemplates.forEach((template) => {
          taskTemplates.push({
            atomId: template.atomId,
            subjectId: template.subjectId,
            taskType: template.taskType,
            instructions: template.instructions,
            resources: template.resources || [],
          });
        });
      });

      if (taskTemplates.length === 0) {
        return res.status(400).json({
          error: 'No task templates found in lesson plan activities',
        });
      }

      // Get enrolled students
      const students = await getEnrolledStudents();

      if (students.length === 0) {
        return res.status(400).json({
          error: 'No enrolled students found',
        });
      }

      // Initialize tracking variables
      let successCount = 0;
      let failureCount = 0;
      const skippedStudents = [];
      const errors = [];
      const assignedTasks = [];

      // Process students and templates in parallel (no awaits inside loops)
      const perStudentResults = await Promise.allSettled(
        students.map(async (student) => {
          const perTemplateResults = await Promise.allSettled(
            taskTemplates.map(async (template) => {
              const hasPrereqs = await checkPrerequisites(student._id, template.atomId);
              if (!hasPrereqs) {
                return {
                  ok: false,
                  studentId: student._id,
                  atomId: template.atomId,
                  reason: 'Prerequisites not completed',
                };
              }

              const existingTask = await EducationTask.findOne({
                studentId: student._id,
                lessonPlanId,
                atomIds: template.atomId,
              }).session(session);
              if (existingTask) {
                return {
                  ok: false,
                  studentId: student._id,
                  atomId: template.atomId,
                  reason: 'Task already assigned',
                };
              }

              const dueAt = calculateDeadline(assignmentDate, deadlineOffsetDays);

              const educationTask = new EducationTask({
                lessonPlanId,
                studentId: student._id,
                atomIds: [template.atomId],
                type: template.taskType,
                status: 'assigned',
                assignedAt: new Date(assignmentDate),
                dueAt,
                uploadUrls: [],
                grade: 'pending',
              });

              const savedTask = await educationTask.save({ session });

              await Progress.findOneAndUpdate(
                { studentId: student._id, atomId: template.atomId },
                {
                  studentId: student._id,
                  atomId: template.atomId,
                  status: 'in_progress',
                  firstStartedAt: new Date(assignmentDate),
                },
                { upsert: true, new: true, session },
              );

              return { ok: true, studentId: student._id, taskId: savedTask._id };
            }),
          );

          const successes = perTemplateResults.filter(
            (r) => r.status === 'fulfilled' && r.value.ok,
          ).length;
          const errorsForStudent = perTemplateResults
            .filter((r) => r.status === 'fulfilled' && !r.value.ok)
            .map((r) => ({
              studentId: r.value.studentId,
              atomId: r.value.atomId,
              reason: r.value.reason,
            }));

          return { studentId: student._id, successes, errorsForStudent };
        }),
      );

      // Aggregate results (no ++, no continue)
      // let successCount = 0;
      // let failureCount = 0;
      // const skippedStudents = [];
      // const errors = [];
      // const assignedTasks = [];

      perStudentResults.forEach((r) => {
        if (r.status !== 'fulfilled') return;
        const { studentId, successes, errorsForStudent } = r.value;
        if (successes > 0) {
          successCount += 1;
          // We don’t collect task documents here; keep your existing total via counts or fetch if needed
        } else if (errorsForStudent.length > 0) {
          failureCount += 1;
          skippedStudents.push(studentId);
        }
        errors.push(...errorsForStudent);
      });

      await session.commitTransaction();

      // Return structured response
      const response = {
        success: true,
        summary: {
          success_count: successCount,
          failure_count: failureCount,
          total_students: students.length,
          total_tasks_assigned: assignedTasks.length,
          skipped: skippedStudents,
          errors,
        },
        lesson_plan: {
          id: lessonPlanId,
          title: lessonPlan.title,
          theme: lessonPlan.theme,
        },
        assignment_details: {
          assignment_date: new Date(assignmentDate),
          deadline_offset_days: deadlineOffsetDays,
          is_auto_assigned: isAutoAssigned,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        error: `Assignment failed: ${error.message}`,
        success: false,
      });
    } finally {
      session.endSession();
    }
  };

  // Get assignment summary by lesson plan
  const getAssignmentSummary = async (req, res) => {
    try {
      const { lessonPlanId } = req.params;

      const tasks = await EducationTask.find({ lessonPlanId })
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name difficulty')
        .sort({ assignedAt: -1 });

      const summary = {
        total_assignments: tasks.length,
        by_status: {
          assigned: tasks.filter((t) => t.status === 'assigned').length,
          in_progress: tasks.filter((t) => t.status === 'in_progress').length,
          completed: tasks.filter((t) => t.status === 'completed').length,
          graded: tasks.filter((t) => t.status === 'graded').length,
        },
        students: new Set(tasks.map((t) => t.studentId._id.toString())).size,
        recent_assignments: tasks.slice(0, 10),
      };

      res.status(200).json(summary);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Assign atoms to students
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const assignAtoms = async (req, res) => {
    try {
      const validation = validateAssignAtomsRequest(req, res);
      if (!validation) return;

      const { requestor, studentId, atomIds, note } = validation;

      const validationResult = await validateStudentAndAtoms(studentId, atomIds, res);
      if (!validationResult) return;

      const { alreadyAssignedAtomIds, newAtomIds } = await checkExistingAssignments(
        studentId,
        atomIds,
      );

      if (newAtomIds.length === 0) {
        return res.status(400).json({
          error: 'All atoms are already assigned to this student',
          alreadyAssignedAtomIds,
        });
      }

      const savedAssignments = await createAssignments(
        studentId,
        newAtomIds,
        requestor.requestorId,
        note,
      );

      const response = await buildAssignAtomsResponse(
        savedAssignments,
        atomIds,
        alreadyAssignedAtomIds,
      );

      res.status(201).json(response);
    } catch (error) {
      console.error('Atom assignment failed');

      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: 'One or more atoms already assigned to this student' });
      }

      if (error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const publishEvaluationResults = async (req, res) => {
    try {
      const { requestor, studentId, evaluations, message, teacherFeedback } = req.body;

      if (!requestor?.requestorId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!hasEducatorAccess(requestor)) {
        return res.status(403).json({
          error: 'Insufficient permissions. Educator, admin, teacher, or owner role required.',
          receivedRole: requestor.role,
          validRoles,
        });
      }

      if (!studentId) {
        return res.status(400).json({ error: 'studentId is required' });
      }

      if (!Array.isArray(evaluations) || evaluations.length === 0) {
        return res.status(400).json({ error: 'evaluations must be a non-empty array' });
      }

      const hasInvalidEvaluation = evaluations.some(
        (evaluation) => !evaluation || !evaluation.category || !Array.isArray(evaluation.tasks),
      );

      if (hasInvalidEvaluation) {
        return res.status(400).json({
          error: 'Each evaluation must include category and tasks array',
        });
      }

      const persistedEvaluations = await evaluationResultsService.publishStudentEvaluationResults({
        studentId,
        teacherId: requestor.requestorId,
        evaluations,
        message,
        teacherFeedback,
      });

      return res.status(201).json({
        message: 'Evaluation results published successfully',
        studentId,
        evaluationsPublished: persistedEvaluations.length,
        categories: persistedEvaluations.map((evaluation) => evaluation.category),
      });
    } catch (error) {
      // Malformed publications are rejected before persistence by the service validator.
      if (
        error.statusCode === 400 ||
        error.name === 'ValidationError' ||
        error.name === 'CastError'
      ) {
        return res.status(400).json({ error: error.message });
      }

      if (error.message === 'Invalid student ID provided.') {
        return res.status(400).json({ error: error.message });
      }

      if (error.message === 'Invalid teacher ID provided.') {
        return res.status(400).json({ error: error.message });
      }

      if (error.message === 'Student profile not found.') {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({
        error: 'Internal server error',
        details: error.message,
      });
    }
  };

  return {
    assignTasks,
    getAssignmentSummary,
    assignAtoms,
    publishEvaluationResults,
  };
};

module.exports = educatorController;
