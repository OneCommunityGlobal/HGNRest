const StudentAtom = require('../models/studentAtom');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');
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
      console.error('Error assigning atoms:', error);

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
      const { requestor, studentId, evaluations, message } = req.body;

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

      const invalidEvaluation = evaluations.find(
        (evaluation) => !evaluation.category || !Array.isArray(evaluation.tasks),
      );

      if (invalidEvaluation) {
        return res.status(400).json({
          error: 'Each evaluation must include category and tasks array',
        });
      }

      const persistedEvaluations = await evaluationResultsService.publishStudentEvaluationResults({
        studentId,
        teacherId: requestor.requestorId,
        evaluations,
        message,
      });

      return res.status(201).json({
        message: 'Evaluation results published successfully',
        studentId,
        evaluationsPublished: persistedEvaluations.length,
        categories: persistedEvaluations.map((evaluation) => evaluation.category),
      });
    } catch (error) {
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
    assignAtoms,
    publishEvaluationResults,
  };
};

module.exports = educatorController;
