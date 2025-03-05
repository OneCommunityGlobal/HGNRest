const Form = require("../models/JobFormsModel");
const Response = require("../models/jobApplicationsModel");

// Create a new form
exports.createForm = async (req, res) => {
  try {
    const { title, description, questions } = req.body;

    // Validate input
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ message: "Title and questions are required." });
    }

    // Create and save the form
    const form = new Form({
      title,
      description,
      questions,
    });

    await form.save();
    res.status(201).json({ message: "Form created successfully.", form });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating form.", error });
  }
};

// Get the format of a specific form
exports.getFormFormat = async (req, res) => {
  try {
    const { formId } = req.params;

    // Find the form by ID
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    res.status(200).json({ form });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching form format.", error });
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
      { new: true, runValidators: true }
    );

    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    res.status(200).json({ message: "Form updated successfully.", form });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating form format.", error });
  }
};

// Get all responses of a form
exports.getFormResponses = async (req, res) => {
  try {
    const { formId } = req.params;

    // Check if form exists
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    // Fetch all responses for the form
    const responses = await Response.find({ formId });

    res.status(200).json({ formTitle: form.title, responses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching form responses.", error });
  }
};

// Get formats of all forms
exports.getAllFormsFormat = async (req, res) => {
    try {
      const forms = await Form.find(); // Fetch all forms
  
      if (forms.length === 0) {
        return res.status(404).json({ message: "No forms found." });
      }
  
      res.status(200).json({ forms });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching all forms format.", error });
    }
  };
  