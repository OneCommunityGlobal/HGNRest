const mongoose = require('mongoose');
const Progress = require('../models/progress');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');

const progressController = function () {
  // Get all progress records
  const getProgress = async (req, res) => {
    try {
      const progress = await Progress.find({})
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get progress by student
  const getProgressByStudent = async (req, res) => {
    try {
      const { studentId } = req.params;
      const progress = await Progress.find({ studentId })
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get progress by atom
  const getProgressByAtom = async (req, res) => {
    try {
      const { atomId } = req.params;
      const progress = await Progress.find({ atomId })
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get specific progress record
  const getProgressById = async (req, res) => {
    try {
      const { id } = req.params;
      const progress = await Progress.findById(id)
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');
      
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }
      
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get progress by student and atom
  const getProgressByStudentAndAtom = async (req, res) => {
    try {
      const { studentId, atomId } = req.params;
      const progress = await Progress.findOne({ studentId, atomId })
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');
      
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }
      
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new progress record
  const createProgress = async (req, res) => {
    try {
      const { 
        studentId, 
        atomId, 
        status, 
        grade, 
        feedback 
      } = req.body;

      // Validate student exists
      const student = await UserProfile.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Validate atom exists
      const atom = await Atom.findById(atomId);
      if (!atom) {
        return res.status(404).json({ error: 'Atom not found' });
      }

      // Check if progress record already exists
      const existingProgress = await Progress.findOne({ studentId, atomId });
      if (existingProgress) {
        return res.status(400).json({ error: 'Progress record already exists for this student and atom' });
      }

      const progress = new Progress({
        studentId,
        atomId,
        status: status || 'not_started',
        grade: grade || 'pending',
        feedback
      });

      const savedProgress = await progress.save();
      const populatedProgress = await Progress.findById(savedProgress._id)
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');

      res.status(201).json(populatedProgress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update progress
  const updateProgress = async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        status, 
        grade, 
        feedback 
      } = req.body;

      const progress = await Progress.findById(id);
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      // Validate status if provided
      if (status) {
        const validStatuses = ['not_started', 'in_progress', 'completed'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ 
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
          });
        }
      }

      // Validate grade if provided
      if (grade) {
        const validGrades = ['A', 'B', 'C', 'D', 'F', 'pending'];
        if (!validGrades.includes(grade)) {
          return res.status(400).json({ 
            error: `Invalid grade. Must be one of: ${validGrades.join(', ')}` 
          });
        }
      }

      // Update firstStartedAt if status is being changed to in_progress
      let firstStartedAt = progress.firstStartedAt;
      if (status === 'in_progress' && progress.status === 'not_started') {
        firstStartedAt = new Date();
      }

      // Update completedAt if status is being changed to completed
      let completedAt = progress.completedAt;
      if (status === 'completed' && progress.status !== 'completed') {
        completedAt = new Date();
      }

      const updatedProgress = await Progress.findByIdAndUpdate(
        id,
        { 
          status, 
          grade, 
          feedback,
          firstStartedAt,
          completedAt
        },
        { new: true, runValidators: true }
      ).populate('studentId', 'firstName lastName email')
       .populate('atomId', 'name description difficulty');

      res.status(200).json(updatedProgress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete progress
  const deleteProgress = async (req, res) => {
    try {
      const { id } = req.params;

      const progress = await Progress.findByIdAndDelete(id);
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      res.status(200).json({ message: 'Progress record deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update progress status
  const updateProgressStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const progress = await Progress.findById(id);
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      const validStatuses = ['not_started', 'in_progress', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }

      // Update firstStartedAt if status is being changed to in_progress
      let firstStartedAt = progress.firstStartedAt;
      if (status === 'in_progress' && progress.status === 'not_started') {
        firstStartedAt = new Date();
      }

      // Update completedAt if status is being changed to completed
      let completedAt = progress.completedAt;
      if (status === 'completed' && progress.status !== 'completed') {
        completedAt = new Date();
      }

      const updatedProgress = await Progress.findByIdAndUpdate(
        id,
        { status, firstStartedAt, completedAt },
        { new: true }
      ).populate('studentId', 'firstName lastName email')
       .populate('atomId', 'name description difficulty');

      res.status(200).json(updatedProgress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Grade progress
  const gradeProgress = async (req, res) => {
    try {
      const { id } = req.params;
      const { grade, feedback } = req.body;

      const progress = await Progress.findById(id);
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      const validGrades = ['A', 'B', 'C', 'D', 'F', 'pending'];
      if (!validGrades.includes(grade)) {
        return res.status(400).json({ 
          error: `Invalid grade. Must be one of: ${validGrades.join(', ')}` 
        });
      }

      const updatedProgress = await Progress.findByIdAndUpdate(
        id,
        { grade, feedback },
        { new: true }
      ).populate('studentId', 'firstName lastName email')
       .populate('atomId', 'name description difficulty');

      res.status(200).json(updatedProgress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get progress by status
  const getProgressByStatus = async (req, res) => {
    try {
      const { status } = req.params;
      const progress = await Progress.find({ status })
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get student progress summary
  const getStudentProgressSummary = async (req, res) => {
    try {
      const { studentId } = req.params;
      
      const progress = await Progress.find({ studentId })
        .populate('atomId', 'name description difficulty subjectId')
        .populate('atomId.subjectId', 'name');

      const summary = {
        total: progress.length,
        notStarted: progress.filter(p => p.status === 'not_started').length,
        inProgress: progress.filter(p => p.status === 'in_progress').length,
        completed: progress.filter(p => p.status === 'completed').length,
        grades: {
          A: progress.filter(p => p.grade === 'A').length,
          B: progress.filter(p => p.grade === 'B').length,
          C: progress.filter(p => p.grade === 'C').length,
          D: progress.filter(p => p.grade === 'D').length,
          F: progress.filter(p => p.grade === 'F').length,
          pending: progress.filter(p => p.grade === 'pending').length
        }
      };

      res.status(200).json(summary);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getProgress,
    getProgressByStudent,
    getProgressByAtom,
    getProgressById,
    getProgressByStudentAndAtom,
    createProgress,
    updateProgress,
    deleteProgress,
    updateProgressStatus,
    gradeProgress,
    getProgressByStatus,
    getStudentProgressSummary
  };
};

module.exports = progressController; 