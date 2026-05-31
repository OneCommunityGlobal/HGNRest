const QuestionSet = require('../models/questionSet');
const { hasPermission } = require('../utilities/permissions');
const {
  JOB_FORM_CATEGORIES,
  sanitizeTargetRole,
  sanitizeObjectIdQuery,
  parseBooleanQuery,
} = require('../utilities/mongoQuerySanitizer');

/** Allowlisted category string; rejects objects and MongoDB operator strings. */
function readAllowedCategory(rawValue) {
  if (rawValue === null || rawValue === undefined || typeof rawValue === 'object') {
    return null;
  }
  const candidate = String(rawValue).trim();
  if (!candidate || candidate.startsWith('$') || !JOB_FORM_CATEGORIES.has(candidate)) {
    return null;
  }
  return candidate;
}

function applyBodyFieldUpdates(questionSet, body, validatedCategory, hasCategoryUpdate) {
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    questionSet.name = body.name;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    questionSet.description = body.description;
  }
  if (hasCategoryUpdate) {
    questionSet.category = validatedCategory;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'targetRole')) {
    questionSet.targetRole = sanitizeTargetRole(body.targetRole) || questionSet.targetRole;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'questions')) {
    questionSet.questions = body.questions;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'isDefault')) {
    questionSet.isDefault = body.isDefault;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    questionSet.isActive = body.isActive;
  }
}

async function clearDefaultQuestionSets(Model, allowedCategory, excludeId = null) {
  let clearQuery = Model.find()
    .where('category')
    .equals(allowedCategory)
    .where('isDefault')
    .equals(true);

  const safeExcludeId = sanitizeObjectIdQuery(excludeId);
  if (safeExcludeId) {
    clearQuery = clearQuery.where('_id').ne(safeExcludeId);
  }

  return clearQuery.updateMany({ $set: { isDefault: false } });
}

const canAccessJobFormManagement = async (requestor) =>
  (await hasPermission(requestor, 'manageJobForms')) ||
  (await hasPermission(requestor, 'createFormQuestions')) ||
  (await hasPermission(requestor, 'editFormQuestions')) ||
  (await hasPermission(requestor, 'deleteFormQuestions'));

const canCreateFormQuestions = async (requestor) =>
  (await hasPermission(requestor, 'manageJobForms')) ||
  (await hasPermission(requestor, 'createFormQuestions'));

const canEditFormQuestions = async (requestor) =>
  (await hasPermission(requestor, 'manageJobForms')) ||
  (await hasPermission(requestor, 'editFormQuestions'));

const canDeleteFormQuestions = async (requestor) =>
  (await hasPermission(requestor, 'manageJobForms')) ||
  (await hasPermission(requestor, 'deleteFormQuestions'));

const questionSetController = {
  // Get all question sets with optional filtering
  async getAllQuestionSets(req, res) {
    try {
      if (!(await canAccessJobFormManagement(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to view question sets.' });
      }

      let listQuery = QuestionSet.find();

      const queryCategory = readAllowedCategory(req.query.category);
      if (queryCategory) {
        listQuery = listQuery.where('category').equals(queryCategory);
      }

      const queryTargetRole = sanitizeTargetRole(req.query.targetRole);
      if (queryTargetRole) {
        listQuery = listQuery.where('targetRole').equals(queryTargetRole);
      }

      const queryIsActive = parseBooleanQuery(req.query.isActive);
      if (queryIsActive !== null) {
        listQuery = listQuery.where('isActive').equals(queryIsActive);
      }

      const queryCreatedBy = sanitizeObjectIdQuery(req.query.createdBy);
      if (queryCreatedBy) {
        listQuery = listQuery.where('createdBy').equals(queryCreatedBy);
      }

      const questionSets = await listQuery
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
      if (!(await canAccessJobFormManagement(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to view question sets.' });
      }

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
      if (!(await canCreateFormQuestions(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to create question sets.' });
      }

      const { name, description, targetRole, questions, isDefault } = req.body;
      const createdBy = req.body.requestor.requestorId;
      const validatedCategory = readAllowedCategory(req.body.category);

      // Validate required fields
      if (!name || !validatedCategory || !questions || questions.length === 0) {
        return res.status(400).json({
          message: 'Name, category, and at least one question are required.',
        });
      }

      const safeTargetRole = sanitizeTargetRole(targetRole) || 'General';

      // If setting as default, unset other defaults in the same category
      if (isDefault) {
        await clearDefaultQuestionSets(QuestionSet, validatedCategory);
      }

      const questionSet = new QuestionSet({
        name,
        description,
        category: validatedCategory,
        targetRole: safeTargetRole,
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
      if (!(await canEditFormQuestions(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to edit question sets.' });
      }

      const { id } = req.params;
      const safeId = sanitizeObjectIdQuery(id);
      if (!safeId) {
        return res.status(400).json({ message: 'Invalid question set id.' });
      }

      const questionSet = await QuestionSet.findById(safeId);
      if (!questionSet) {
        return res.status(404).json({ message: 'Question set not found' });
      }

      const { isDefault } = req.body;
      const lastModifiedBy = req.body.requestor.requestorId;
      const hasCategoryUpdate = Object.prototype.hasOwnProperty.call(req.body, 'category');
      let categoryValue = questionSet.category;
      if (hasCategoryUpdate) {
        categoryValue = req.body.category;
      }
      const validatedCategory = readAllowedCategory(categoryValue);

      if (!validatedCategory) {
        return res.status(400).json({ message: 'Invalid category.' });
      }

      // If setting as default, unset other defaults in the same category
      if (isDefault && (!questionSet.isDefault || questionSet.category !== validatedCategory)) {
        await clearDefaultQuestionSets(QuestionSet, validatedCategory, safeId);
      }

      applyBodyFieldUpdates(questionSet, req.body, validatedCategory, hasCategoryUpdate);
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
      if (!(await canDeleteFormQuestions(req.body.requestor))) {
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
      if (!(await canAccessJobFormManagement(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to view question sets.' });
      }

      const { category } = req.params;
      const validatedCategory = readAllowedCategory(category);

      if (!validatedCategory) {
        return res.status(400).json({ message: 'Invalid category.' });
      }

      const questionSets = await QuestionSet.find()
        .where('category')
        .equals(validatedCategory)
        .where('isActive')
        .equals(true)
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
      if (!(await canCreateFormQuestions(req.body.requestor))) {
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
