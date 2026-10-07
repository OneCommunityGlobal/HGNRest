const mongoose = require('mongoose');
const Form = require('../models/JobFormsModel');
const Response = require('../models/jobApplicationsModel');
const upload = require('../middleware/multerMiddleware');
const QuestionSet = require('../models/questionSet');
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

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// Public Dropbox upload for job form file answers
exports.postFormResponseUpload = async (req, res) => {
  const uploadFile = req.file;

  const errorMap = {
    expired_access_token: 'Dropbox access token expired. Please reconnect Dropbox.',
    shared_link_already_exists: 'A shared link already exists for this file.',
    path_conflict: 'A file with this name already exists in Dropbox.',
  };

  const accessTokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
      client_id: process.env.DROPBOX_APP_KEY,
      client_secret: process.env.DROPBOX_APP_SECRET,
    }),
  });

  try {
    if (!uploadFile) return res.status(400).json({ message: 'No file uploaded' });

    if (uploadFile.size > 5 * 1024 * 1024) {
      return res.status(500).json({ message: 'File size should be less than or equal to 5MB' });
    }

    if (
      ![
        'application/pdf',
        'application/doc',
        'application/docx',
        'image/jpeg',
        'image/png',
        'image/bmp',
      ].includes(uploadFile.mimetype)
    ) {
      return res.status(500).json({
        message: 'Invalid file type. Please upload a PDF, DOC, DOCX, JPG, PNG, or BMP file.',
      });
    }

    const dropboxPath = `${process.env.DROPBOX_PATH}/${uploadFile.originalname}`;
    const tokenData = await accessTokenResponse.json();

    const uploadFileResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Dropbox-API-Arg': JSON.stringify({
          autorename: true,
          mode: 'add',
          path: dropboxPath,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: uploadFile.buffer,
    });

    if (!uploadFileResponse.ok) {
      const text = await uploadFileResponse.text();
      let shortMessage = 'Dropbox upload failed';
      const errorObj = tryParseJSON(text);
      if (errorObj) {
        const tag = errorObj?.error?.['.tag'];
        const summary = errorObj?.error_summary;
        shortMessage = errorMap[tag] || `Dropbox error: ${summary || tag || 'Unknown error'}`;
      } else if (text.includes('malformed')) {
        shortMessage = 'Dropbox access token is malformed. Please re-authenticate.';
      } else if (text.includes('expired_access_token')) {
        shortMessage = 'Dropbox access token expired. Please reconnect Dropbox.';
      } else {
        shortMessage = `Dropbox upload failed: ${text}`;
      }
      return res.status(500).json({ message: `${shortMessage}` });
    }

    const uploadFileSharedLinkRes = await fetch(
      'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: dropboxPath,
        }),
      },
    );

    if (!uploadFileSharedLinkRes.ok) {
      const uploadFileSharedLinkResText = await uploadFileSharedLinkRes.text();
      let sharedShortMessage = 'Dropbox upload failed';
      const sharedErrorObj = tryParseJSON(uploadFileSharedLinkResText);
      if (sharedErrorObj) {
        const sharedTag = sharedErrorObj?.error?.['.tag'];
        const summary = sharedErrorObj?.error_summary;
        sharedShortMessage =
          errorMap[sharedTag] || `Dropbox error: ${summary || sharedTag || 'Unknown error'}`;
      } else if (uploadFileSharedLinkResText.includes('malformed')) {
        sharedShortMessage = 'Dropbox access token is malformed. Please re-authenticate.';
      } else if (uploadFileSharedLinkResText.includes('expired_access_token')) {
        sharedShortMessage = 'Dropbox access token expired. Please reconnect Dropbox.';
      } else {
        sharedShortMessage = `Dropbox upload failed: ${uploadFileSharedLinkResText}`;
      }
      return res.status(500).json({ message: `${sharedShortMessage}` });
    }

    const uploadFileSharedLinkResData = await uploadFileSharedLinkRes.json();
    res.status(200).json({ data: uploadFileSharedLinkResData });
  } catch (error) {
    res.status(500).json({ message: 'Error Uploading', error });
  }
};

// Public submit of job form responses
exports.postFormResponses = async (req, res) => {
  try {
    const { answers } = req.body;
    const formId = new mongoose.Types.ObjectId(req.body.formId);
    const respondent = answers[1]?.answer;

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    if (!Array.isArray(form.questions)) {
      return res.status(404).json({ message: 'Form not found or has no questions.' });
    }

    const formMap = Object.fromEntries(
      form.questions.map((q) => [
        q._id.toString(),
        {
          questionText: q._doc?.questionText || q.questionText,
          isRequired: q._doc?.isRequired || q.isRequired,
          answer: null,
        },
      ]),
    );

    let answerError = null;
    answers.some((ans) => {
      const qid = ans.questionId.toString();
      if (!formMap[qid]) {
        answerError = {
          status: 404,
          message: `Invalid question ID: ${qid}`,
        };
        return true;
      }
      formMap[qid].answer = ans.answer;
      return false;
    });

    if (answerError) {
      return res.status(answerError.status).json({
        message: answerError.message,
      });
    }

    let requiredError = null;
    Object.values(formMap).some((item) => {
      const empty = item.answer === '' || item.answer === null || item.answer === undefined;
      if (item.isRequired && empty) {
        requiredError = {
          status: 400,
          message: `Answer required for question: ${item.questionText}`,
        };
        return true;
      }
      return false;
    });

    if (requiredError) {
      return res.status(requiredError.status).json({
        message: requiredError.message,
      });
    }

    const response = new Response({
      formId,
      answers,
      respondent,
    });

    await response.save();

    // eslint-disable-next-line global-require
    const emailSender = require('../utilities/emailSender');
    const emailBody = `
          subject: ${form.title} Application Received from ${respondent}!,
          html: 
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
    <h2 style="color: #2c3e50;">Application Received ${respondent}!</h2>
    <p>We’ve successfully received your application. Below are your responses:</p>

    <div style="margin-top: 10px;">
      ${answers
        .map((answer) => {
          const computedQuestionId = answer.questionId?.toString?.() ?? String(answer.questionId);
          const questionText = formMap[computedQuestionId]?.questionText || 'Unknown Question';
          return `
            <div style="margin-bottom: 10px;">
              <strong style="color: #1a73e8;">
              ${questionText}
              </strong><br>
              <span>${answer.answer}</span>
            </div>
          `;
        })
        .join('')}
    </div>

    <br>
    <p>Regards,<br><strong>Software Team HGN</strong></p>
  </div>
`;
    emailSender(
      process.env.JOB_APPLICATION_RECIPIENT_EMAIL,
      `${form.title} Application Received from ${respondent}!`,
      emailBody,
      null,
      null,
      'jae@onecommunityglobal.org',
    );

    res.status(201).json({ message: 'Responses submitted successfully.', response });
  } catch (error) {
    res.status(500).json({ message: 'Error Saving form responses.', error });
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
