const QuestionSet = require('../models/questionSet');
const { hasPermission } = require('../utilities/permissions');

const questionSetController = {
  // Get all question sets with optional filtering
  async getAllQuestionSets(req, res) {
    try {
      const { category, targetRole, isActive, createdBy } = req.query;
      const filter = {};

      if (category) filter.category = category;
      if (targetRole) filter.targetRole = targetRole;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (createdBy) filter.createdBy = createdBy;

      const questionSets = await QuestionSet.find(filter)
        .populate('createdBy', 'firstName lastName')
        .populate('lastModifiedBy', 'firstName lastName')
        .sort({ isDefault: -1, createdAt: -1 });

      res.status(200).json({ questionSets });
    } catch (error) {
      console.error('Error fetching question sets:', error);
      res.status(500).json({ message: 'Error fetching question sets', error: error.message });
    }
  },

  // Get a specific question set by ID
  async getQuestionSetById(req, res) {
    try {
      const { id } = req.params;

      const questionSet = await QuestionSet.findById(id)
        .populate('createdBy', 'firstName lastName')
        .populate('lastModifiedBy', 'firstName lastName');

      if (!questionSet) {
        return res.status(404).json({ message: 'Question set not found' });
      }

      res.status(200).json({ questionSet });
    } catch (error) {
      console.error('Error fetching question set:', error);
      res.status(500).json({ message: 'Error fetching question set', error: error.message });
    }
  },

  // Create a new question set
  async createQuestionSet(req, res) {
    try {
      // Check permissions
      if (!(await hasPermission(req.body.requestor, 'createFormQuestions'))) {
        return res.status(403).json({ message: 'You are not authorized to create question sets.' });
      }

      const { name, description, category, targetRole, questions, isDefault } = req.body;
      const createdBy = req.body.requestor.requestorId;

      // Validate required fields
      if (!name || !category || !questions || questions.length === 0) {
        return res.status(400).json({
          message: 'Name, category, and at least one question are required.',
        });
      }

      // If setting as default, unset other defaults in the same category
      if (isDefault) {
        await QuestionSet.updateMany({ category, isDefault: true }, { isDefault: false });
      }

      const questionSet = new QuestionSet({
        name,
        description,
        category,
        targetRole: targetRole || 'General',
        questions,
        isDefault: isDefault || false,
        createdBy,
        lastModifiedBy: createdBy,
      });

      await questionSet.save();

      // Populate the response
      await questionSet.populate('createdBy', 'firstName lastName');

      res.status(201).json({
        message: 'Question set created successfully',
        questionSet,
      });
    } catch (error) {
      console.error('Error creating question set:', error);
      res.status(500).json({ message: 'Error creating question set', error: error.message });
    }
  },

  // Update an existing question set
  async updateQuestionSet(req, res) {
    try {
      // Check permissions
      if (!(await hasPermission(req.body.requestor, 'editFormQuestions'))) {
        return res.status(403).json({ message: 'You are not authorized to edit question sets.' });
      }

      const { id } = req.params;
      const { name, description, category, targetRole, questions, isDefault, isActive } = req.body;
      const lastModifiedBy = req.body.requestor.requestorId;

      const questionSet = await QuestionSet.findById(id);
      if (!questionSet) {
        return res.status(404).json({ message: 'Question set not found' });
      }

      // If setting as default, unset other defaults in the same category
      if (isDefault && (!questionSet.isDefault || questionSet.category !== category)) {
        await QuestionSet.updateMany(
          { category: category || questionSet.category, isDefault: true, _id: { $ne: id } },
          { isDefault: false },
        );
      }

      // Update fields
      if (name !== undefined) questionSet.name = name;
      if (description !== undefined) questionSet.description = description;
      if (category !== undefined) questionSet.category = category;
      if (targetRole !== undefined) questionSet.targetRole = targetRole;
      if (questions !== undefined) questionSet.questions = questions;
      if (isDefault !== undefined) questionSet.isDefault = isDefault;
      if (isActive !== undefined) questionSet.isActive = isActive;
      questionSet.lastModifiedBy = lastModifiedBy;

      await questionSet.save();
      await questionSet.populate('createdBy', 'firstName lastName');
      await questionSet.populate('lastModifiedBy', 'firstName lastName');

      res.status(200).json({
        message: 'Question set updated successfully',
        questionSet,
      });
    } catch (error) {
      console.error('Error updating question set:', error);
      res.status(500).json({ message: 'Error updating question set', error: error.message });
    }
  },

  // Delete a question set
  async deleteQuestionSet(req, res) {
    try {
      // Check permissions
      if (!(await hasPermission(req.body.requestor, 'deleteFormQuestions'))) {
        return res.status(403).json({ message: 'You are not authorized to delete question sets.' });
      }

      const { id } = req.params;

      const questionSet = await QuestionSet.findById(id);
      if (!questionSet) {
        return res.status(404).json({ message: 'Question set not found' });
      }

      // Check if question set is being used by any forms
      const JobForm = require('../models/JobFormsModel');
      const formsUsingQuestionSet = await JobForm.find({
        'questionSets.questionSetId': id,
      });

      if (formsUsingQuestionSet.length > 0) {
        return res.status(400).json({
          message: 'Cannot delete question set. It is currently being used by one or more forms.',
          formsCount: formsUsingQuestionSet.length,
        });
      }

      await QuestionSet.findByIdAndDelete(id);

      res.status(200).json({ message: 'Question set deleted successfully' });
    } catch (error) {
      console.error('Error deleting question set:', error);
      res.status(500).json({ message: 'Error deleting question set', error: error.message });
    }
  },

  // Get question sets by category
  async getQuestionSetsByCategory(req, res) {
    try {
      const { category } = req.params;

      const questionSets = await QuestionSet.find({
        category,
        isActive: true,
      })
        .populate('createdBy', 'firstName lastName')
        .sort({ isDefault: -1, name: 1 });

      res.status(200).json({ questionSets });
    } catch (error) {
      console.error('Error fetching question sets by category:', error);
      res.status(500).json({ message: 'Error fetching question sets', error: error.message });
    }
  },

  // Clone a question set
  async cloneQuestionSet(req, res) {
    try {
      // Check permissions
      if (!(await hasPermission(req.body.requestor, 'createFormQuestions'))) {
        return res.status(403).json({ message: 'You are not authorized to clone question sets.' });
      }

      const { id } = req.params;
      const { newName } = req.body;
      const createdBy = req.body.requestor.requestorId;

      const originalQuestionSet = await QuestionSet.findById(id);
      if (!originalQuestionSet) {
        return res.status(404).json({ message: 'Question set not found' });
      }

      const clonedQuestionSet = new QuestionSet({
        name: newName || `${originalQuestionSet.name} (Copy)`,
        description: originalQuestionSet.description,
        category: originalQuestionSet.category,
        targetRole: originalQuestionSet.targetRole,
        questions: originalQuestionSet.questions,
        isDefault: false, // Cloned sets are never default
        createdBy,
        lastModifiedBy: createdBy,
      });

      await clonedQuestionSet.save();
      await clonedQuestionSet.populate('createdBy', 'firstName lastName');

      res.status(201).json({
        message: 'Question set cloned successfully',
        questionSet: clonedQuestionSet,
      });
    } catch (error) {
      console.error('Error cloning question set:', error);
      res.status(500).json({ message: 'Error cloning question set', error: error.message });
    }
  },
};

module.exports = questionSetController;
