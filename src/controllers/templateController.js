
const Template = require("../models/TemplateModel");

// Get all templates
exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find();
    if (templates.length === 0) {
      return res.status(200).json({ templates: [] });
    }
    res.status(200).json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ message: "Error fetching templates.", error: error.message });
  }
};

// Create a new template
exports.createTemplate = async (req, res) => {
  try {
    const { name, fields } = req.body;
    // Validate input
    if (!name || !fields || fields.length === 0) {
      return res.status(400).json({ message: "Template name and fields are required." });
    }
    
    // Check if template with the same name already exists
    const existingTemplate = await Template.findOne({ name });
    if (existingTemplate) {
      return res.status(400).json({ message: "Template with this name already exists." });
    }
    
    // Create and save the template
    const template = new Template({
      name,
      fields
    });
    
    await template.save();
    res.status(201).json({ message: "Template created successfully.", template });
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ message: "Error creating template.", error: error.message });
  }
};

// Get a template by ID
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).json({ message: "Template not found." });
    }
    res.status(200).json({ template });
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({ message: "Error fetching template.", error: error.message });
  }
};

// Update a template
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fields } = req.body;
    
    // Validate input
    if (!name || !fields || fields.length === 0) {
      return res.status(400).json({ message: "Template name and fields are required." });
    }
    
    // Find and update the template
    const template = await Template.findByIdAndUpdate(
      id,
      { name, fields },
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({ message: "Template not found." });
    }
    
    res.status(200).json({ message: "Template updated successfully.", template });
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ message: "Error updating template.", error: error.message });
  }
};

// Delete a template
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findByIdAndDelete(id);
    
    if (!template) {
      return res.status(404).json({ message: "Template not found." });
    }
    
    res.status(200).json({ message: "Template deleted successfully." });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ message: "Error deleting template.", error: error.message });
  }
};