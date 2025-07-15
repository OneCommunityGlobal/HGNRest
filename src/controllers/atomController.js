const mongoose = require('mongoose');
const Atom = require('../models/atom');
const Subject = require('../models/subject');

const atomController = function () {
  // Get all atoms
  const getAtoms = async (req, res) => {
    try {
      const atoms = await Atom.find({})
        .populate('subjectId', 'name iconUrl')
        .populate('prerequisites', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(atoms);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get atoms by subject
  const getAtomsBySubject = async (req, res) => {
    try {
      const { subjectId } = req.params;
      const atoms = await Atom.find({ subjectId })
        .populate('subjectId', 'name iconUrl')
        .populate('prerequisites', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(atoms);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get atom by ID
  const getAtomById = async (req, res) => {
    try {
      const { id } = req.params;
      const atom = await Atom.findById(id)
        .populate('subjectId', 'name iconUrl')
        .populate('prerequisites', 'name description difficulty');
      
      if (!atom) {
        return res.status(404).json({ error: 'Atom not found' });
      }
      
      res.status(200).json(atom);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new atom
  const createAtom = async (req, res) => {
    try {
      const { 
        subjectId, 
        name, 
        description, 
        difficulty, 
        prerequisites, 
        learningStrategies, 
        learningTools 
      } = req.body;

      // Validate subject exists
      const subject = await Subject.findById(subjectId);
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      // Validate prerequisites exist
      if (prerequisites && prerequisites.length > 0) {
        const prerequisiteAtoms = await Atom.find({ _id: { $in: prerequisites } });
        if (prerequisiteAtoms.length !== prerequisites.length) {
          return res.status(400).json({ error: 'One or more prerequisites not found' });
        }
      }

      const atom = new Atom({
        subjectId,
        name,
        description,
        difficulty: difficulty || 'beginner',
        prerequisites: prerequisites || [],
        learningStrategies: learningStrategies || [],
        learningTools: learningTools || []
      });

      const savedAtom = await atom.save();

      // Add atom to subject's atomIds array
      subject.atomIds.push(savedAtom._id);
      await subject.save();

      const populatedAtom = await Atom.findById(savedAtom._id)
        .populate('subjectId', 'name iconUrl')
        .populate('prerequisites', 'name description difficulty');

      res.status(201).json(populatedAtom);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update atom
  const updateAtom = async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        subjectId, 
        name, 
        description, 
        difficulty, 
        prerequisites, 
        learningStrategies, 
        learningTools 
      } = req.body;

      const atom = await Atom.findById(id);
      if (!atom) {
        return res.status(404).json({ error: 'Atom not found' });
      }

      // If subjectId is being changed, update the old and new subjects
      if (subjectId && !atom.subjectId.equals(subjectId)) {
        const oldSubject = await Subject.findById(atom.subjectId);
        const newSubject = await Subject.findById(subjectId);

        if (!newSubject) {
          return res.status(404).json({ error: 'New subject not found' });
        }

        // Remove from old subject
        if (oldSubject) {
          oldSubject.atomIds = oldSubject.atomIds.filter(
            atomId => !atomId.equals(id)
          );
          await oldSubject.save();
        }

        // Add to new subject
        newSubject.atomIds.push(id);
        await newSubject.save();
      }

      // Validate prerequisites exist
      if (prerequisites && prerequisites.length > 0) {
        const prerequisiteAtoms = await Atom.find({ _id: { $in: prerequisites } });
        if (prerequisiteAtoms.length !== prerequisites.length) {
          return res.status(400).json({ error: 'One or more prerequisites not found' });
        }
      }

      const updatedAtom = await Atom.findByIdAndUpdate(
        id,
        { 
          subjectId, 
          name, 
          description, 
          difficulty, 
          prerequisites, 
          learningStrategies, 
          learningTools 
        },
        { new: true, runValidators: true }
      ).populate('subjectId', 'name iconUrl')
       .populate('prerequisites', 'name description difficulty');

      res.status(200).json(updatedAtom);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete atom
  const deleteAtom = async (req, res) => {
    try {
      const { id } = req.params;

      const atom = await Atom.findById(id);
      if (!atom) {
        return res.status(404).json({ error: 'Atom not found' });
      }

      // Remove from subject's atomIds array
      const subject = await Subject.findById(atom.subjectId);
      if (subject) {
        subject.atomIds = subject.atomIds.filter(
          atomId => !atomId.equals(id)
        );
        await subject.save();
      }

      // Check if atom is a prerequisite for other atoms
      const dependentAtoms = await Atom.find({ prerequisites: id });
      if (dependentAtoms.length > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete atom that is a prerequisite for other atoms' 
        });
      }

      await Atom.findByIdAndDelete(id);
      res.status(200).json({ message: 'Atom deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get atoms by difficulty
  const getAtomsByDifficulty = async (req, res) => {
    try {
      const { difficulty } = req.params;
      const atoms = await Atom.find({ difficulty })
        .populate('subjectId', 'name iconUrl')
        .populate('prerequisites', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(atoms);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getAtoms,
    getAtomsBySubject,
    getAtomById,
    createAtom,
    updateAtom,
    deleteAtom,
    getAtomsByDifficulty
  };
};

module.exports = atomController; 