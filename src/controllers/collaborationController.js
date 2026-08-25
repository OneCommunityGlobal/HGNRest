const Form = require('../models/JobFormsModel');
const Response = require('../models/jobApplicationsModel');

// Create a new form
exports.createForm = async (req, res) => {
  try {
    const { title, description, questions } = req.body;

    // Validate input
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title and questions are required.' });
    }

    // Create and save the form
    const form = new Form({
      title,
      description,
      questions,
    });

    await form.save();
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
    // const { formId } = req.params;
    const { title, description, questions, formId } = req.body;

    // Find and update the form
    const form = await Form.findByIdAndUpdate(
      formId,
      { title, description, questions },
      { new: true, runValidators: true },
    );

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
    const forms = await Form.find(); // Fetch all forms

    if (forms.length === 0) {
      return res.status(404).json({ message: 'No forms found.' });
    }
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

/**
 * POST /api/jobforms/:formId/responses
 * Submit an application response to a job form.
 *
 * Body (JSON or multipart/form-data):
 *   respondent {string} - applicant full name (required)
 *   email      {string} - applicant email (required)
 *   answers    {Array}  - [{ questionId, answer }]
 *
 * Optional multipart field:
 *   resume     {file}   - resume file (stored in Azure, URL saved on response)
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
    const { respondent, email, answers } = req.body;

    // --- 400: validate required fields ---
    if (!respondent || !email || !answers) {
      return res.status(400).json({ error: 'respondent, email, and answers are required.' });
    }

    // --- 404: form must exist ---
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ error: 'Form not found.' });
    }

    // --- 409: duplicate check (same email for same form) ---
    const existing = await Response.findOne({ formId, email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Application already submitted.' });
    }

    // --- Optional: resume upload to Azure ---
    let resumeUrl = '';
    if (req.file) {
      try {
        const { uploadFileToAzureBlobStorage } = require('../utilities/AzureBlobImages');
        const safeFormTitle = form.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const ext = req.file.originalname.split('.').pop();
        const blobName = `resumes/${safeFormTitle}_${safeEmail}_${Date.now()}.${ext}`;
        resumeUrl = await uploadFileToAzureBlobStorage(req.file, blobName);
      } catch (uploadErr) {
        console.error('Resume upload failed (non-fatal):', uploadErr.message);
        // Upload failure is non-fatal — proceed without resume
      }
    }

    // --- Parse answers if sent as a JSON string (multipart/form-data case) ---
    let parsedAnswers = answers;
    if (typeof answers === 'string') {
      try {
        parsedAnswers = JSON.parse(answers);
      } catch {
        return res.status(400).json({ error: 'answers must be a valid JSON array.' });
      }
    }

    // --- Save response ---
    const response = new Response({
      formId,
      respondent: respondent.trim(),
      email: email.trim().toLowerCase(),
      answers: parsedAnswers,
      resumeUrl,
    });

    await response.save();

    // --- Send confirmation email (non-fatal if it fails) ---
    try {
      const emailSender = require('../utilities/emailSender');
      const emailBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2>Application Received — ${form.title}</h2>
          <p>Hi ${respondent.trim()},</p>
          <p>Thank you for applying for <strong>${form.title}</strong>. We have received your application and will be in touch shortly.</p>
          <p>If you have any questions, feel free to reach out.</p>
          <br/>
          <p>Best regards,<br/>One Community</p>
        </div>
      `;
      await emailSender(
        [email.trim().toLowerCase()],
        `Application Received — ${form.title}`,
        emailBody,
      );
    } catch (emailErr) {
      console.error('Confirmation email failed (non-fatal):', emailErr.message);
    }

    return res.status(201).json({ message: 'Application submitted successfully.', response });
  } catch (error) {
    console.error('Error submitting form response:', error);
    return res.status(500).json({ message: 'Error submitting application.', error: error.message });
  }
};
