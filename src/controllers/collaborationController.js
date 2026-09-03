const mongoose = require('mongoose');
const Form = require('../models/JobFormsModel');
const Response = require('../models/jobApplicationsModel');
const upload = require('../middleware/multerMiddleware');
const QuestionSet = require('../models/questionSet');
const { uploadFileToAzureBlobStorage } = require('../utilities/AzureBlobImages');
const emailSender = require('../utilities/emailSender');
const {
  canManageJobForms,
  canCreateFormQuestions,
  canEditFormQuestions,
  canDeleteFormQuestions,
} = require('../utilities/jobFormPermissions');
const {
  sanitizeCategory,
  parseBooleanQuery,
  sanitizeObjectIdQuery,
} = require('../utilities/mongoQuerySanitizer');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function buildFormUpdateData(body, lastModifiedBy) {
  const updateData = { lastModifiedBy };
  const fields = [
    'title',
    'description',
    'category',
    'questions',
    'questionSets',
    'fixedFields',
    'jobLinks',
    'settings',
  ];

  fields.forEach((field) => {
    if (hasOwn(body, field)) {
      updateData[field] = body[field];
    }
  });

  return updateData;
}

function resolveIncludeAll(includeAll) {
  let resolvedIncludeAll = true;
  if (typeof includeAll === 'boolean') {
    resolvedIncludeAll = includeAll;
  }
  return resolvedIncludeAll;
}

function selectQuestionsToImport(questionSet, resolvedIncludeAll, selectedQuestions) {
  if (resolvedIncludeAll) {
    return questionSet.questions;
  }
  return questionSet.questions.filter((_, index) => selectedQuestions.includes(index));
}

/** Legacy forms may lack createdBy; set it from the requestor before save. */
function ensureFormMetadata(form, requestor) {
  const requestorId = requestor?.requestorId;
  if (!requestorId) {
    return;
  }
  if (!form.createdBy) {
    form.createdBy = requestorId;
  }
  form.lastModifiedBy = requestorId;
}

function sanitizeBlobPart(value, fallback = 'file') {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase();
  return cleaned || fallback;
}

function filesByField(req) {
  const map = {};
  if (req.file) {
    map[req.file.fieldname || 'resume'] = req.file;
  }
  (req.files || []).forEach((file) => {
    map[file.fieldname] = file;
  });
  return map;
}

function fileExtension(file) {
  if (file?.originalname?.includes('.')) {
    return file.originalname.split('.').pop();
  }
  return 'bin';
}

async function uploadOptionalFile(file, blobName) {
  if (!file) {
    return '';
  }
  try {
    return await uploadFileToAzureBlobStorage(file, blobName);
  } catch (uploadErr) {
    console.error('Application file upload failed (non-fatal):', uploadErr.message);
    return '';
  }
}

function parseJsonField(value, errorMessage) {
  if (typeof value !== 'string') {
    return { value, error: null };
  }
  try {
    return { value: JSON.parse(value), error: null };
  } catch {
    return { value: null, error: errorMessage };
  }
}

function resolveApplicationInput(body) {
  if (body.payload) {
    const parsed = parseJsonField(body.payload, 'Invalid application payload.');
    if (parsed.error) {
      return { error: parsed.error };
    }
    const payload = parsed.value || {};
    return {
      respondent: payload.applicantName || body.respondent,
      email: payload.applicantEmail || body.email,
      answers: payload.answers || [],
      profile: payload.profile || {},
    };
  }

  const parsedAnswers = parseJsonField(body.answers, 'answers must be a valid JSON array.');
  if (parsedAnswers.error) {
    return { error: parsedAnswers.error };
  }

  return {
    respondent: body.respondent,
    email: body.email,
    answers: parsedAnswers.value,
    profile: {},
  };
}

async function uploadResumeIfPresent(resumeFile, safeFormTitle, safeEmail) {
  if (!resumeFile) {
    return '';
  }
  return uploadOptionalFile(
    resumeFile,
    `resumes/${safeFormTitle}_${safeEmail}_${Date.now()}.${fileExtension(resumeFile)}`,
  );
}

async function buildAnswerEntry(item, fileMap, safeFormTitle, safeEmail) {
  const qIdStr = item.questionId ? String(item.questionId) : '';
  const uploaded = qIdStr ? fileMap[`questionFile_${qIdStr}`] : null;
  const questionId = item.questionId || new mongoose.Types.ObjectId();

  if (!uploaded) {
    return { questionId, answer: item.answer };
  }

  const fileUrl = await uploadOptionalFile(
    uploaded,
    `resumes/${safeFormTitle}_${safeEmail}_q_${sanitizeBlobPart(qIdStr)}_${Date.now()}.${fileExtension(uploaded)}`,
  );

  return {
    questionId,
    answer: {
      fileName: uploaded.originalname,
      mimeType: uploaded.mimetype,
      size: uploaded.size,
      ...(fileUrl ? { url: fileUrl } : {}),
    },
  };
}

async function buildAnswersFromSubmission(answers, fileMap, safeFormTitle, safeEmail) {
  const answersList = Array.isArray(answers) ? answers : [];
  const builtAnswers = [];
  for (const item of answersList) {
    builtAnswers.push(await buildAnswerEntry(item, fileMap, safeFormTitle, safeEmail));
  }
  return builtAnswers;
}

function appendResumeAndProfileAnswers(
  builtAnswers,
  resumeFile,
  resumeUrl,
  respondent,
  normalizedEmail,
  profile,
) {
  if (resumeFile) {
    builtAnswers.push({
      questionId: new mongoose.Types.ObjectId(),
      answer: {
        type: 'resume',
        fileName: resumeFile.originalname,
        mimeType: resumeFile.mimetype,
        size: resumeFile.size,
        ...(resumeUrl ? { url: resumeUrl } : {}),
      },
    });
  }

  if (respondent || Object.keys(profile || {}).length > 0) {
    builtAnswers.push({
      questionId: new mongoose.Types.ObjectId(),
      answer: {
        type: 'applicantProfile',
        applicantName: respondent,
        applicantEmail: normalizedEmail,
        ...profile,
      },
    });
  }
}

async function sendApplicationConfirmationEmail(form, respondent, normalizedEmail) {
  try {
    const displayName = String(respondent || normalizedEmail).trim();
    const emailBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2>Application Received — ${form.title}</h2>
          <p>Hi ${displayName},</p>
          <p>Thank you for applying for <strong>${form.title}</strong>. We have received your application and will be in touch shortly.</p>
          <p>If you have any questions, feel free to reach out.</p>
          <br/>
          <p>Best regards,<br/>One Community</p>
        </div>
      `;
    await emailSender([normalizedEmail], `Application Received — ${form.title}`, emailBody);
  } catch (emailErr) {
    console.error('Confirmation email failed (non-fatal):', emailErr.message);
  }
}

// Create a new form
exports.createForm = async (req, res) => {
  try {
    if (!(await canManageJobForms(req.body.requestor))) {
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
    if (!(await canEditFormQuestions(req.body.requestor))) {
      return res.status(403).json({ message: 'You are not authorized to edit forms.' });
    }

    const { formId } = req.body;
    const lastModifiedBy = req.body.requestor.requestorId;
    const updateData = buildFormUpdateData(req.body, lastModifiedBy);

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

// Submit a job application for a form (public — applicants)
exports.submitJobApplication = async (req, res) => {
  try {
    const { formId } = req.params;
    let payload = {};
    try {
      payload = JSON.parse(req.body.payload || '{}');
    } catch (parseError) {
      return res.status(400).json({ message: 'Invalid application payload.' });
    }

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    const { applicantName, applicantEmail, answers: answersPayload = [], profile = {} } = payload;
    if (!applicantEmail || !String(applicantEmail).trim()) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const fileByField = {};
    (req.files || []).forEach((file) => {
      fileByField[file.fieldname] = file;
    });

    const builtAnswers = answersPayload.map(({ questionId, answer }) => {
      const qIdStr = questionId ? String(questionId) : '';
      const uploaded = qIdStr ? fileByField[`questionFile_${qIdStr}`] : null;
      if (uploaded) {
        return {
          questionId: questionId || new mongoose.Types.ObjectId(),
          answer: {
            fileName: uploaded.originalname,
            mimeType: uploaded.mimetype,
            size: uploaded.size,
          },
        };
      }
      return {
        questionId: questionId || new mongoose.Types.ObjectId(),
        answer,
      };
    });

    const { resume } = fileByField;
    if (resume) {
      builtAnswers.push({
        questionId: new mongoose.Types.ObjectId(),
        answer: {
          type: 'resume',
          fileName: resume.originalname,
          mimeType: resume.mimetype,
          size: resume.size,
        },
      });
    }

    builtAnswers.push({
      questionId: new mongoose.Types.ObjectId(),
      answer: {
        type: 'applicantProfile',
        applicantName,
        applicantEmail,
        ...profile,
      },
    });

    const submission = new Response({
      formId,
      respondent: String(applicantEmail).trim(),
      answers: builtAnswers,
    });

    await submission.save();

    res.status(201).json({
      message: 'Application submitted successfully.',
      responseId: submission._id,
    });
  } catch (error) {
    console.error('Error submitting job application:', error);
    res.status(500).json({ message: 'Error submitting application.', error: error.message });
  }
};

exports.submitJobApplicationMiddleware = upload.any();

/**
 * POST /api/jobforms/:formId/responses
 * Submit an application response to a job form (public — paired with frontend PR 5469).
 *
 * Body (JSON or multipart/form-data):
 *   respondent {string} - applicant full name (required)
 *   email      {string} - applicant email (required)
 *   answers    {Array}  - [{ questionId, answer }] (array or JSON string)
 *
 * Optional multipart field:
 *   resume     {file}   - resume file (stored in Azure; URL saved on the response)
 *
 * Responses:
 *   201 - { message, response }
 *   400 - missing required fields
 *   409 - duplicate application
 *   404 - form not found
 *   500 - server error
 */
exports.submitFormResponse = async (req, res) => {
  try {
    const { formId } = req.params;
    const resolved = resolveApplicationInput(req.body || {});
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }

    const { respondent, email, answers, profile } = resolved;
    if (!email || answers == null) {
      return res.status(400).json({ error: 'respondent, email, and answers are required.' });
    }

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ error: 'Form not found.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await Response.findOne({
      formId,
      $or: [{ email: normalizedEmail }, { respondent: normalizedEmail }],
    });
    if (existing) {
      return res.status(409).json({ error: 'Application already submitted.' });
    }

    const fileMap = filesByField(req);
    const safeFormTitle = sanitizeBlobPart(form.title, 'form');
    const safeEmail = sanitizeBlobPart(normalizedEmail, 'applicant');
    const resumeFile = fileMap.resume;
    const resumeUrl = await uploadResumeIfPresent(resumeFile, safeFormTitle, safeEmail);
    const builtAnswers = await buildAnswersFromSubmission(
      answers,
      fileMap,
      safeFormTitle,
      safeEmail,
    );

    appendResumeAndProfileAnswers(
      builtAnswers,
      resumeFile,
      resumeUrl,
      respondent,
      normalizedEmail,
      profile,
    );

    const response = new Response({
      formId,
      respondent: String(respondent || normalizedEmail).trim(),
      email: normalizedEmail,
      answers: builtAnswers,
      resumeUrl,
    });

    await response.save();
    await sendApplicationConfirmationEmail(form, respondent, normalizedEmail);

    return res.status(201).json({ message: 'Application submitted successfully.', response });
  } catch (error) {
    console.error('Error submitting form response:', error);
    return res.status(500).json({ message: 'Error submitting application.', error: error.message });
  }
};

// Get all responses of a form
exports.getFormResponses = async (req, res) => {
  try {
    if (!(await canManageJobForms(req.body.requestor))) {
      return res.status(403).json({ message: 'You are not authorized to view form responses.' });
    }

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
    let listQuery = Form.find();

    const safeCategory = sanitizeCategory(req.query.category);
    if (safeCategory) {
      listQuery = listQuery.where('category').equals(safeCategory);
    }

    const safeIsActive = parseBooleanQuery(req.query.isActive);
    if (safeIsActive === true || safeIsActive === false) {
      listQuery = listQuery.where('isActive').equals(safeIsActive);
    }

    const safeCreatedBy = sanitizeObjectIdQuery(req.query.createdBy);
    if (safeCreatedBy) {
      listQuery = listQuery.where('createdBy').equals(safeCreatedBy);
    }

    const forms = await listQuery
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
    if (!(await canCreateFormQuestions(req.body.requestor))) {
      return res.status(403).json({ message: 'You are not authorized to add questions.' });
    }

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
    const hasPosition = hasOwn(req.body, 'position');
    if (hasPosition && position >= 0 && position <= form.questions.length) {
      form.questions.splice(position, 0, question);
    } else {
      form.questions.push(question);
    }

    ensureFormMetadata(form, req.body.requestor);
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
    if (!(await canEditFormQuestions(req.body.requestor))) {
      return res.status(403).json({ message: 'You are not authorized to update questions.' });
    }

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

    // Update the question (exclude requestor metadata from question payload)
    const { requestor, ...questionPayload } = req.body;
    form.questions[questionIndex] = questionPayload;

    ensureFormMetadata(form, requestor || req.body.requestor);
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
    if (!(await canDeleteFormQuestions(req.body.requestor))) {
      return res.status(403).json({ message: 'You are not authorized to delete questions.' });
    }

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
    ensureFormMetadata(form, req.body.requestor);
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
    if (!(await canEditFormQuestions(req.body.requestor))) {
      return res.status(403).json({ message: 'You are not authorized to reorder questions.' });
    }

    const { formId } = req.params;

    if (!hasOwn(req.body, 'fromIndex') || !hasOwn(req.body, 'toIndex')) {
      return res.status(400).json({ message: 'From and to indices are required.' });
    }

    const { fromIndex, toIndex } = req.body;

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

    ensureFormMetadata(form, req.body.requestor);
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
    if (!(await canManageJobForms(req.body.requestor))) {
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
    if (!(await canEditFormQuestions(req.body.requestor))) {
      return res.status(403).json({ message: 'You are not authorized to import questions.' });
    }

    const { formId } = req.params;
    const { questionSetId, selectedQuestions, includeAll } = req.body;
    const resolvedIncludeAll = resolveIncludeAll(includeAll);

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
        includeAll: resolvedIncludeAll,
        selectedQuestions: selectedQuestions || [],
      });
    } else {
      // Update existing reference
      form.questionSets[existingQuestionSetIndex].includeAll = resolvedIncludeAll;
      form.questionSets[existingQuestionSetIndex].selectedQuestions = selectedQuestions || [];
    }

    // Import the actual questions
    const questionsToImport = selectQuestionsToImport(
      questionSet,
      resolvedIncludeAll,
      selectedQuestions || [],
    );

    questionsToImport.forEach((question) => {
      const plain = question.toObject ? question.toObject() : { ...question };
      form.questions.push({
        ...plain,
        fromQuestionSet: questionSetId,
      });
    });

    // Update usage count
    questionSet.usageCount += 1;
    await questionSet.save();

    ensureFormMetadata(form, req.body.requestor);
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
