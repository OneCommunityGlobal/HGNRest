const QuestionSet = require('../models/questionSet');
const { hasPermission } = require('../utilities/permissions');
const {
  sanitizeCategory,
  sanitizeTargetRole,
  sanitizeObjectIdQuery,
  parseBooleanQuery,
} = require('../utilities/mongoQuerySanitizer');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function applyBodyFieldUpdates(questionSet, body, validatedCategory, hasCategoryUpdate) {
  if (hasOwn(body, 'name')) {
    questionSet.name = body.name;
  }
  if (hasOwn(body, 'description')) {
    questionSet.description = body.description;
  }
  if (hasCategoryUpdate) {
    questionSet.category = validatedCategory;
  }
  if (hasOwn(body, 'targetRole')) {
    questionSet.targetRole = sanitizeTargetRole(body.targetRole) || questionSet.targetRole;
  }
  if (hasOwn(body, 'questions')) {
    questionSet.questions = body.questions;
  }
  if (hasOwn(body, 'isDefault')) {
    questionSet.isDefault = body.isDefault;
  }
  if (hasOwn(body, 'isActive')) {
    questionSet.isActive = body.isActive;
  }
}

function shouldUnsetOtherDefaults(isDefault, questionSet, validatedCategory) {
  if (isDefault !== true) {
    return false;
  }
  if (questionSet.isDefault === false) {
    return true;
  }
  return questionSet.category !== validatedCategory;
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
  async getAllQuestionSets(req, res) {
    try {
      if (!(await canAccessJobFormManagement(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to view question sets.' });
      }

      let listQuery = QuestionSet.find();

      const safeCategory = sanitizeCategory(req.query.category);
      if (safeCategory) {
        listQuery = listQuery.where('category').equals(safeCategory);
      }

      const safeTargetRole = sanitizeTargetRole(req.query.targetRole);
      if (safeTargetRole) {
        listQuery = listQuery.where('targetRole').equals(safeTargetRole);
      }

      const safeIsActive = parseBooleanQuery(req.query.isActive);
      if (safeIsActive === true || safeIsActive === false) {
        listQuery = listQuery.where('isActive').equals(safeIsActive);
      }

      const safeCreatedBy = sanitizeObjectIdQuery(req.query.createdBy);
      if (safeCreatedBy) {
        listQuery = listQuery.where('createdBy').equals(safeCreatedBy);
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

  async getQuestionSetById(req, res) {
    try {
      if (!(await canAccessJobFormManagement(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to view question sets.' });
      }

      const safeId = sanitizeObjectIdQuery(req.params.id);
      if (!safeId) {
        return res.status(400).json({ message: 'Invalid question set id.' });
      }

      const questionSet = await QuestionSet.findById(safeId)
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

  async createQuestionSet(req, res) {
    try {
      if (!(await canCreateFormQuestions(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to create question sets.' });
      }

      const { name, description, targetRole, questions, isDefault } = req.body;
      const createdBy = req.body.requestor.requestorId;
      const validatedCategory = sanitizeCategory(req.body.category);

      if (!name || !validatedCategory || !questions || questions.length === 0) {
        return res.status(400).json({
          message: 'Name, category, and at least one question are required.',
        });
      }

      const safeTargetRole = sanitizeTargetRole(targetRole) || 'General';

      if (isDefault === true) {
        await clearDefaultQuestionSets(QuestionSet, validatedCategory);
      }

      const questionSet = new QuestionSet({
        name,
        description,
        category: validatedCategory,
        targetRole: safeTargetRole,
        questions,
        isDefault: isDefault === true,
        createdBy,
        lastModifiedBy: createdBy,
      });

      await questionSet.save();
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

  async updateQuestionSet(req, res) {
    try {
      if (!(await canEditFormQuestions(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to edit question sets.' });
      }

      const safeId = sanitizeObjectIdQuery(req.params.id);
      if (!safeId) {
        return res.status(400).json({ message: 'Invalid question set id.' });
      }

      const questionSet = await QuestionSet.findById(safeId);
      if (!questionSet) {
        return res.status(404).json({ message: 'Question set not found' });
      }

      const { isDefault } = req.body;
      const lastModifiedBy = req.body.requestor.requestorId;
      const hasCategoryUpdate = hasOwn(req.body, 'category');
      let validatedCategory = sanitizeCategory(questionSet.category);
      if (hasCategoryUpdate) {
        validatedCategory = sanitizeCategory(req.body.category);
      }

      if (!validatedCategory) {
        return res.status(400).json({ message: 'Invalid category.' });
      }

      if (shouldUnsetOtherDefaults(isDefault, questionSet, validatedCategory)) {
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

  async deleteQuestionSet(req, res) {
    try {
      if (!(await canDeleteFormQuestions(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to delete question sets.' });
      }

      const safeId = sanitizeObjectIdQuery(req.params.id);
      if (!safeId) {
        return res.status(400).json({ message: 'Invalid question set id.' });
      }

      const questionSet = await QuestionSet.findById(safeId);
      if (!questionSet) {
        return res.status(404).json({ message: 'Question set not found' });
      }

      const JobForm = require('../models/JobFormsModel');
      const formsUsingQuestionSet = await JobForm.find()
        .where('questionSets.questionSetId')
        .equals(safeId);

      if (formsUsingQuestionSet.length > 0) {
        return res.status(400).json({
          message: 'Cannot delete question set. It is currently being used by one or more forms.',
          formsCount: formsUsingQuestionSet.length,
        });
      }

      await QuestionSet.findByIdAndDelete(safeId);

      res.status(200).json({ message: 'Question set deleted successfully' });
    } catch (error) {
      console.error('Error deleting question set:', error);
      res.status(500).json({ message: 'Error deleting question set', error: error.message });
    }
  },

  async getQuestionSetsByCategory(req, res) {
    try {
      if (!(await canAccessJobFormManagement(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to view question sets.' });
      }

      const validatedCategory = sanitizeCategory(req.params.category);

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

  async cloneQuestionSet(req, res) {
    try {
      if (!(await canCreateFormQuestions(req.body.requestor))) {
        return res.status(403).json({ message: 'You are not authorized to clone question sets.' });
      }

      const safeId = sanitizeObjectIdQuery(req.params.id);
      if (!safeId) {
        return res.status(400).json({ message: 'Invalid question set id.' });
      }

      const { newName } = req.body;
      const createdBy = req.body.requestor.requestorId;

      const originalQuestionSet = await QuestionSet.findById(safeId);
      if (!originalQuestionSet) {
        return res.status(404).json({ message: 'Question set not found' });
      }

      const clonedQuestionSet = new QuestionSet({
        name: newName || `${originalQuestionSet.name} (Copy)`,
        description: originalQuestionSet.description,
        category: originalQuestionSet.category,
        targetRole: originalQuestionSet.targetRole,
        questions: originalQuestionSet.questions,
        isDefault: false,
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
