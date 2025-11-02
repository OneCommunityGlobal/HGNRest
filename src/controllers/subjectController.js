const mongoose = require('mongoose');
const Subject = require('../models/subject');
const Atom = require('../models/atom');

const subjectController = function () {
  // Get all subjects
  const getSubjects = async (req, res) => {
    try {
      const subjects = await Subject.find({})
        .populate('atomIds', 'name description difficulty')
        .sort({ sequence: 1 });
      res.status(200).json(subjects);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get subject by ID
  const getSubjectById = async (req, res) => {
    try {
      const { id } = req.params;
      const subject = await Subject.findById(id)
        .populate('atomIds', 'name description difficulty');
      
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      
      res.status(200).json(subject);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new subject
  const createSubject = async (req, res) => {
    try {
      const { name, iconUrl, sequence, description } = req.body;
      
      // Check if subject with same name already exists
      const existingSubject = await Subject.findOne({ name });
      if (existingSubject) {
        return res.status(400).json({ error: 'Subject with this name already exists' });
      }

      const subject = new Subject({
        name,
        iconUrl,
        sequence: sequence || 0,
        description
      });

      const savedSubject = await subject.save();
      res.status(201).json(savedSubject);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update subject
  const updateSubject = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, iconUrl, sequence, description, atomIds } = req.body;

      const subject = await Subject.findById(id);
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      // Check if name is being changed and if it conflicts with existing subject
      if (name && name !== subject.name) {
        const existingSubject = await Subject.findOne({ name, _id: { $ne: id } });
        if (existingSubject) {
          return res.status(400).json({ error: 'Subject with this name already exists' });
        }
      }

      const updatedSubject = await Subject.findByIdAndUpdate(
        id,
        { name, iconUrl, sequence, description, atomIds },
        { new: true, runValidators: true }
      ).populate('atomIds', 'name description difficulty');

      res.status(200).json(updatedSubject);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete subject
  const deleteSubject = async (req, res) => {
    try {
      const { id } = req.params;

      // Check if subject has atoms
      const atoms = await Atom.find({ subjectId: id });
      if (atoms.length > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete subject that has atoms. Please remove all atoms first.' 
        });
      }

      const subject = await Subject.findByIdAndDelete(id);
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      res.status(200).json({ message: 'Subject deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Add atom to subject
  const addAtomToSubject = async (req, res) => {
    try {
      const { subjectId, atomId } = req.params;

      const subject = await Subject.findById(subjectId);
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      const atom = await Atom.findById(atomId);
      if (!atom) {
        return res.status(404).json({ error: 'Atom not found' });
      }

      if (subject.atomIds.includes(atomId)) {
        return res.status(400).json({ error: 'Atom already exists in this subject' });
      }

      subject.atomIds.push(atomId);
      await subject.save();

      const updatedSubject = await Subject.findById(subjectId)
        .populate('atomIds', 'name description difficulty');

      res.status(200).json(updatedSubject);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Remove atom from subject
  const removeAtomFromSubject = async (req, res) => {
    try {
      const { subjectId, atomId } = req.params;

      const subject = await Subject.findById(subjectId);
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      const atomIndex = subject.atomIds.indexOf(atomId);
      if (atomIndex === -1) {
        return res.status(404).json({ error: 'Atom not found in this subject' });
      }

      subject.atomIds.splice(atomIndex, 1);
      await subject.save();

      const updatedSubject = await Subject.findById(subjectId)
        .populate('atomIds', 'name description difficulty');

      res.status(200).json(updatedSubject);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject,
    addAtomToSubject,
    removeAtomFromSubject
  };
};

module.exports = subjectController; 