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
  

//Pallavi..
exports.addQuestion = async (req, res) => {
  try {
    const { formId } = req.params;
    const { question, position } = req.body;

    // Validate input
    if (!question || !question.questionText || !question.questionType) {
      return res.status(400).json({ message: "Question text and type are required." });
    }

    // Find the form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    // Insert the question at the specified position or append to the end
    if (position !== undefined && position >= 0 && position <= form.questions.length) {
      form.questions.splice(position, 0, question);
    } else {
      form.questions.push(question);
    }

    await form.save();
    res.status(200).json({ 
      message: "Question added successfully.", 
      form 
    });
  } catch (error) {
    console.error("Error adding question:", error);
    res.status(500).json({ message: "Error adding question.", error: error.message });
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
      return res.status(404).json({ message: "Form not found." });
    }

    // Check if question index is valid
    if (questionIndex < 0 || questionIndex >= form.questions.length) {
      return res.status(400).json({ message: "Invalid question index." });
    }

    // Update the question
    form.questions[questionIndex] = updatedQuestion;
    await form.save();

    res.status(200).json({ 
      message: "Question updated successfully.", 
      form 
    });
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({ message: "Error updating question.", error: error.message });
  }
};

// Delete a question from a form
exports.deleteQuestion = async (req, res) => {
  try {
    const { formId, questionIndex } = req.params;

    // Find the form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    // Check if question index is valid
    if (questionIndex < 0 || questionIndex >= form.questions.length) {
      return res.status(400).json({ message: "Invalid question index." });
    }

    // Remove the question
    form.questions.splice(questionIndex, 1);
    await form.save();

    res.status(200).json({ 
      message: "Question deleted successfully.", 
      form 
    });
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({ message: "Error deleting question.", error: error.message });
  }
};

// Reorder questions in a form
exports.reorderQuestions = async (req, res) => {
  try {
    const { formId } = req.params;
    const { fromIndex, toIndex } = req.body;

    // Validate input
    if (fromIndex === undefined || toIndex === undefined) {
      return res.status(400).json({ message: "From and to indices are required." });
    }

    // Find the form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    // Check if indices are valid
    if (
      fromIndex < 0 || 
      fromIndex >= form.questions.length ||
      toIndex < 0 ||
      toIndex >= form.questions.length
    ) {
      return res.status(400).json({ message: "Invalid indices." });
    }

    // Reorder the questions
    const [movedQuestion] = form.questions.splice(fromIndex, 1);
    form.questions.splice(toIndex, 0, movedQuestion);

    await form.save();
    res.status(200).json({ 
      message: "Questions reordered successfully.", 
      form 
    });
  } catch (error) {
    console.error("Error reordering questions:", error);
    res.status(500).json({ message: "Error reordering questions.", error: error.message });
  }
};