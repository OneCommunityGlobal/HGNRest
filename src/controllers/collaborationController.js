const { ObjectId } = require('mongoose').Types;
// const express = require('express');
// const axios = require('axios');
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
//
// post all responses of a form
exports.postFormResponseUpload = async (req, res) => {
  console.log('inside postFormResponseUpload');
  console.log(req.file);
  /* const multer = require('multer');
    
     const storage = multer.memoryStorage();
      const upload = multer({
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024
      }
    }); */

  try {
    // 18 and 19 Software Developers
    // need to be changed for different jobForms
    // const resumeFile = req.answers[18];
    const uploadFile = req.file;
    // if (!uploadFile) return res.status (400, 'No file uploaded');
    console.log('resumeFile');
    console.log(uploadFile.originalname);

    // to upload the files
    const dropboxAccessToken = process.env.DROPBOX_ACCESS_TOKEN;
    const dropboxPath = `/resumes-upload/${uploadFile.originalname}`;
    console.log(dropboxPath);

    const uploadFileResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${dropboxAccessToken}`,

        'Dropbox-API-Arg': JSON.stringify({
          autorename: true,
          mode: 'add',
          path: dropboxPath,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: uploadFile.buffer,
    });
    // Dropbox returns JSON *if* successful
    if (!uploadFileResponse.ok) {
      const text = await uploadFileResponse.text();
      console.error('Dropbox error:', text);
      throw new Error(`Dropbox upload failed: ${text}`);
    }
    const uploadFileResponseData = await uploadFileResponse.json();

    console.log('Dropbox Response');
    console.log(uploadFileResponseData);

    const uploadFileSharedLinkRes = await fetch(
      'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${dropboxAccessToken}`,
          'Content-Type': 'application/json',
        },
        settings: {
          access: 'viewer',
          allow_download: true,
          audience: 'public',
          requested_visibility: 'public',
        },
        body: JSON.stringify({
          path: dropboxPath,
        }),
      },
    );
    console.log(uploadFileSharedLinkRes);

    if (!uploadFileSharedLinkRes.ok) {
      const uploadFileSharedLinkResText = await uploadFileSharedLinkRes.text();
      console.error(uploadFileSharedLinkResText);
      console.error('Dropbox Shared File Link error:', uploadFileSharedLinkResText);
      throw new Error(`Dropbox Shared File Link failed: ${uploadFileSharedLinkResText}`);
    }
    const uploadFileSharedLinkResData = await uploadFileSharedLinkRes.json();
    console.log('uploadFileSharedLinkResData');
    console.log(uploadFileSharedLinkResData);

    res.status(200).json({ data: uploadFileSharedLinkResData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error Uploading', error });
  }
};

// post all responses of a form
exports.postFormResponses = async (req, res) => {
  console.log('inside postFormResponses');
  try {
    const { answers } = req.body;
    const formId = new ObjectId(req.body.formId);
    console.log('formId');
    console.log(formId);
    console.log('req.body.formId');
    console.log(req.body.formId);
    console.log(answers);

    const respondent = answers[1].answer;
    console.log('respondent');
    console.log(respondent);

    // Check if form exists
    // const form = await Form.findById(formId);
    const form = await Form.findById(formId);
    console.log(form);
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    // Create and save the form
    const response = new Response({
      formId,
      answers,
      respondent,
    });
    console.log(response);
    // Save the responses for the form

    await response.save();

    // Send email to oneCommunity Email Address
    const emailSender = require('../utilities/emailSender');
    /* const emailBody = `
          subject: Application Received from ${respondent}!!!!!!!!!,
          html: 
            <h2>Application Received ${respondent}!!!!!!!!!</h2>
            ${answers.map((answer) => `${answer.questionId}: ${answer.answer}`).join('<br>')}
            <br>
            <p>Regards,<br>Software Team HGN</p>`; */
    const emailBody = `
          subject: Application Received from ${respondent}!!!!!!!!!,
          html: 
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
    <h2 style="color: #2c3e50;">Application Received ${respondent}!</h2>
    <p>We’ve successfully received your application. Below are your responses:</p>

    <div style="margin-top: 10px;">
      ${answers
        // Sort by _id ascending
        .sort((a, b) => (a._id > b._id ? 1 : -1))
        .map(
          (answer) => `
            <div style="margin-bottom: 10px;">
              <strong style="color: #1a73e8;">${answer.questionId}</strong><br>
              <span>${answer.answer}</span>
            </div>
          `,
        )
        .join('')}
    </div>

    <br>
    <p>Regards,<br><strong>Software Team HGN</strong></p>
  </div>
`;
    emailSender(
      process.env.REACT_APP_EMAIL, // recipents ,
      'Application Received!!!!!!!!!!', // subject
      emailBody, // message
      null, // attachments
      null, //  cc
      'onecommunityglobal@gmail.com', // reply to
    );
    console.log('email sent');

    res.status(201).json({ message: 'Responses submitted successfully.', response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error Saving form responses.', error });
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
