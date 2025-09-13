const Form = require('../models/JobFormsModel');
const Response = require('../models/jobApplicationsModel');
const QuestionSet = require('../models/questionSet');
const { hasPermission } = require('../utilities/permissions');

// Create a new form
exports.createForm = async (req, res) => {
  try {
    // Check permissions
    if (!(await hasPermission(req.body.requestor, 'manageJobForms'))) {
      return res.status(403).json({ message: 'You are not authorized to create forms.' });
    }

    const {
      title,
      description,
      category,
      questions,
      questionSets,
      fixedFields,
      jobLinks,
      settings,
    } = req.body;
    const createdBy = req.body.requestor.requestorId;

    // Validate input
    if (!title) {
      return res.status(400).json({ message: 'Title is required.' });
    }

    // Create and save the form
    const form = new Form({
      title,
      description,
      category: category || 'General',
      questions: questions || [],
      questionSets: questionSets || [],
      fixedFields: fixedFields || {},
      jobLinks: jobLinks || {},
      settings: settings || {},
      createdBy,
      lastModifiedBy: createdBy,
    });

    await form.save();
    await form.populate('createdBy', 'firstName lastName');
    await form.populate('questionSets.questionSetId');

    res.status(201).json({ message: 'Form created successfully.', form });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating form.', error });
  }
};

// Get the format of a specific form
exports.getFormFormat = async (req, res) => {
  try {
    const { formId } = req.params;

    // Find the form by ID
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    res.status(200).json({ form });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching form format.', error });
  }
};

// Update a form format
exports.updateFormFormat = async (req, res) => {
  try {
    // Check permissions
    if (!(await hasPermission(req.body.requestor, 'editFormQuestions'))) {
      return res.status(403).json({ message: 'You are not authorized to edit forms.' });
    }

    const {
      title,
      description,
      category,
      questions,
      questionSets,
      fixedFields,
      jobLinks,
      settings,
      formId,
    } = req.body;
    const lastModifiedBy = req.body.requestor.requestorId;

    const updateData = { lastModifiedBy };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (questions !== undefined) updateData.questions = questions;
    if (questionSets !== undefined) updateData.questionSets = questionSets;
    if (fixedFields !== undefined) updateData.fixedFields = fixedFields;
    if (jobLinks !== undefined) updateData.jobLinks = jobLinks;
    if (settings !== undefined) updateData.settings = settings;

    // Find and update the form
    const form = await Form.findByIdAndUpdate(formId, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('createdBy', 'firstName lastName')
      .populate('lastModifiedBy', 'firstName lastName')
      .populate('questionSets.questionSetId');

    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    res.status(200).json({ message: 'Form updated successfully.', form });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating form format.', error });
  }
};

// Get all responses of a form
exports.getFormResponses = async (req, res) => {
  try {
    const { formId } = req.params;

    // Check if form exists
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    // Fetch all responses for the form
    const responses = await Response.find({ formId });

    res.status(200).json({ formTitle: form.title, responses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching form responses.', error });
  }
};

// Get formats of all forms
exports.getAllFormsFormat = async (req, res) => {
  try {
    const { category, isActive, createdBy } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (createdBy) filter.createdBy = createdBy;

    const forms = await Form.find(filter)
      .populate('createdBy', 'firstName lastName')
      .populate('lastModifiedBy', 'firstName lastName')
      .populate('questionSets.questionSetId')
      .sort({ createdAt: -1 });

    res.status(200).json({ forms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching all forms format.', error });
  }
};

// ..
exports.addQuestion = async (req, res) => {
  try {
    const { formId } = req.params;
    const { question, position } = req.body;

    // Validate input
    if (!question || !question.questionText || !question.questionType) {
      return res.status(400).json({ message: 'Question text and type are required.' });
    }

    // Find the form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    // Insert the question at the specified position or append to the end
    if (position !== undefined && position >= 0 && position <= form.questions.length) {
      form.questions.splice(position, 0, question);
    } else {
      form.questions.push(question);
    }

    await form.save();
    res.status(200).json({
      message: 'Question added successfully.',
      form,
    });
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ message: 'Error adding question.', error: error.message });
  }
};

// Update a specific question in a form
exports.updateQuestion = async (req, res) => {
  try {
    const { formId, questionIndex } = req.params;
    const updatedQuestion = req.body;

    // Find the form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    // Check if question index is valid
    if (questionIndex < 0 || questionIndex >= form.questions.length) {
      return res.status(400).json({ message: 'Invalid question index.' });
    }

    // Update the question
    form.questions[questionIndex] = updatedQuestion;
    await form.save();

    res.status(200).json({
      message: 'Question updated successfully.',
      form,
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ message: 'Error updating question.', error: error.message });
  }
};

// Delete a question from a form
exports.deleteQuestion = async (req, res) => {
  try {
    const { formId, questionIndex } = req.params;

    // Find the form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    // Check if question index is valid
    if (questionIndex < 0 || questionIndex >= form.questions.length) {
      return res.status(400).json({ message: 'Invalid question index.' });
    }

    // Remove the question
    form.questions.splice(questionIndex, 1);
    await form.save();

    res.status(200).json({
      message: 'Question deleted successfully.',
      form,
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Error deleting question.', error: error.message });
  }
};

// Reorder questions in a form
exports.reorderQuestions = async (req, res) => {
  try {
    const { formId } = req.params;
    const { fromIndex, toIndex } = req.body;

    // Validate input
    if (fromIndex === undefined || toIndex === undefined) {
      return res.status(400).json({ message: 'From and to indices are required.' });
    }

    // Find the form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    // Check if indices are valid
    if (
      fromIndex < 0 ||
      fromIndex >= form.questions.length ||
      toIndex < 0 ||
      toIndex >= form.questions.length
    ) {
      return res.status(400).json({ message: 'Invalid indices.' });
    }

    // Reorder the questions
    const [movedQuestion] = form.questions.splice(fromIndex, 1);
    form.questions.splice(toIndex, 0, movedQuestion);

    await form.save();
    res.status(200).json({
      message: 'Questions reordered successfully.',
      form,
    });
  } catch (error) {
    console.error('Error reordering questions:', error);
    res.status(500).json({ message: 'Error reordering questions.', error: error.message });
  }
};

// Delete a form
exports.deleteForm = async (req, res) => {
  try {
    // Check permissions
    if (!(await hasPermission(req.body.requestor, 'manageJobForms'))) {
      return res.status(403).json({ message: 'You are not authorized to delete forms.' });
    }

    const { formId } = req.params;

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    // Check if there are any responses to this form
    const responseCount = await Response.countDocuments({ formId });
    if (responseCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete form. It has received responses.',
        responseCount,
      });
    }

    await Form.findByIdAndDelete(formId);

    res.status(200).json({ message: 'Form deleted successfully.' });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ message: 'Error deleting form.', error: error.message });
  }
};

// Import questions from a question set to a form
exports.importQuestionsFromSet = async (req, res) => {
  try {
    // Check permissions
    if (!(await hasPermission(req.body.requestor, 'editFormQuestions'))) {
      return res.status(403).json({ message: 'You are not authorized to import questions.' });
    }

    const { formId } = req.params;
    const { questionSetId, selectedQuestions, includeAll } = req.body;

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    const questionSet = await QuestionSet.findById(questionSetId);
    if (!questionSet) {
      return res.status(404).json({ message: 'Question set not found.' });
    }

    // Add the question set reference if not already present
    const existingQuestionSetIndex = form.questionSets.findIndex(
      (qs) => qs.questionSetId.toString() === questionSetId,
    );

    if (existingQuestionSetIndex === -1) {
      form.questionSets.push({
        questionSetId,
        includeAll: includeAll !== undefined ? includeAll : true,
        selectedQuestions: selectedQuestions || [],
      });
    } else {
      // Update existing reference
      form.questionSets[existingQuestionSetIndex].includeAll =
        includeAll !== undefined ? includeAll : true;
      form.questionSets[existingQuestionSetIndex].selectedQuestions = selectedQuestions || [];
    }

    // Import the actual questions
    const questionsToImport = includeAll
      ? questionSet.questions
      : questionSet.questions.filter((_, index) => selectedQuestions.includes(index));

    questionsToImport.forEach((question) => {
      form.questions.push({
        ...question.toObject(),
        fromQuestionSet: questionSetId,
      });
    });

    // Update usage count
    questionSet.usageCount += 1;
    await questionSet.save();

    form.lastModifiedBy = req.body.requestor.requestorId;
    await form.save();
    await form.populate('questionSets.questionSetId');

    res.status(200).json({
      message: 'Questions imported successfully.',
      form,
      importedCount: questionsToImport.length,
    });
  } catch (error) {
    console.error('Error importing questions:', error);
    res.status(500).json({ message: 'Error importing questions.', error: error.message });
  }
};
