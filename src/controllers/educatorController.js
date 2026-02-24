const StudentAtom = require('../models/studentAtom');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');

const educatorController = function () {
  /**
   * Assign atoms to students
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const assignAtoms = async (req, res) => {
    try {
      const { requestor } = req.body;
      const { studentId, atomType, atomTypes, note } = req.body;

      // Validate requestor exists and has proper permissions
      if (!requestor || !requestor.requestorId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user has educator/admin/owner role
      const validRoles = ['admin', 'educator', 'teacher', 'owner', 'Owner', 'Administrator'];
      if (!validRoles.includes(requestor.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions. Educator, admin, teacher, or owner role required.',
          receivedRole: requestor.role,
          validRoles,
        });
      }

      // Validate required fields
      if (!studentId) {
        return res.status(400).json({ error: 'student_id is required' });
      }

      // Support both single atomType and multiple atomTypes
      let atomIds = [];
      if (atomTypes && Array.isArray(atomTypes)) {
        atomIds = atomTypes;
      } else if (atomType) {
        atomIds = [atomType];
      } else {
        return res.status(400).json({ error: 'atom_type or atom_types array is required' });
      }

      // Validate student exists
      const student = await UserProfile.findById(studentId);
      if (!student) {
        return res.status(404).json({
          error: 'Student not found',
          studentId,
          message: 'Please check if the student ID exists in the database',
        });
      }

      // Validate all atoms exist
      const atoms = await Atom.find({ _id: { $in: atomIds } });
      const foundAtomIds = atoms.map((atom) => atom._id.toString());
      const missingAtomIds = atomIds.filter((id) => !foundAtomIds.includes(id.toString()));

      if (missingAtomIds.length > 0) {
        return res.status(404).json({
          error: 'One or more atoms not found',
          missingAtomIds,
          message: 'Please check if all atom IDs exist in the database',
        });
      }

      // Check for existing assignments
      const existingAssignments = await StudentAtom.find({
        studentId,
        atomId: { $in: atomIds },
      });

      const alreadyAssignedAtomIds = existingAssignments.map((assignment) =>
        assignment.atomId.toString(),
      );
      const newAtomIds = atomIds.filter((id) => !alreadyAssignedAtomIds.includes(id.toString()));

      if (newAtomIds.length === 0) {
        return res.status(400).json({
          error: 'All atoms are already assigned to this student',
          alreadyAssignedAtomIds,
        });
      }

      // Create new atom assignments for atoms that aren't already assigned
      const assignmentsToCreate = newAtomIds.map((atomId) => ({
        studentId,
        atomId,
        assignedBy: requestor.requestorId,
        note: note || undefined,
      }));

      const savedAssignments = await StudentAtom.insertMany(assignmentsToCreate);

      // Populate the response with referenced data
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
        successfullyAssigned: newAtomIds.length,
        alreadyAssigned: alreadyAssignedAtomIds.length,
      };

      // Include information about already assigned atoms if any
      if (alreadyAssignedAtomIds.length > 0) {
        response.alreadyAssignedAtomIds = alreadyAssignedAtomIds;
        response.message += ` (${alreadyAssignedAtomIds.length} were already assigned)`;
      }

      res.status(201).json(response);
    } catch (error) {
      console.error('Error assigning atoms:', error);

      // Handle duplicate key error
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: 'One or more atoms already assigned to this student' });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    assignAtoms,
  };
};

module.exports = educatorController;
