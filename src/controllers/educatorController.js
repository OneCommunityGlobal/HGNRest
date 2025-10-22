const mongoose = require('mongoose');
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
      const { studentId, atomType, note } = req.body;

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
          validRoles: validRoles
        });
      }

      // Validate required fields
      if (!studentId) {
        return res.status(400).json({ error: 'student_id is required' });
      }

      if (!atomType) {
        return res.status(400).json({ error: 'atom_type is required' });
      }

      // Validate student exists
      const student = await UserProfile.findById(studentId);
      if (!student) {
        return res.status(404).json({ 
          error: 'Student not found',
          studentId: studentId,
          message: 'Please check if the student ID exists in the database'
        });
      }

      // Validate atom exists
      const atom = await Atom.findById(atomType);
      if (!atom) {
        return res.status(404).json({ 
          error: 'Atom not found',
          atomType: atomType,
          message: 'Please check if the atom ID exists in the database'
        });
      }

      // Check for duplicate assignment
      const existingAssignment = await StudentAtom.findOne({
        studentId: studentId,
        atomId: atomType
      });

      if (existingAssignment) {
        return res.status(400).json({ error: 'Atom already assigned to this student' });
      }

      // Create new atom assignment
      const studentAtom = new StudentAtom({
        studentId: studentId,
        atomId: atomType,
        assignedBy: requestor.requestorId,
        note: note || undefined
      });

      const savedAssignment = await studentAtom.save();

      // Populate the response with referenced data
      const populatedAssignment = await StudentAtom.findById(savedAssignment._id)
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .populate('assignedBy', 'firstName lastName email');

      res.status(201).json({
        message: 'Atom assigned successfully',
        assignment: populatedAssignment
      });

    } catch (error) {
      console.error('Error assigning atom:', error);
      
      // Handle duplicate key error
      if (error.code === 11000) {
        return res.status(400).json({ error: 'Atom already assigned to this student' });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    assignAtoms
  };
};

module.exports = educatorController;
