const express = require("express");
const formController = require("../controllers/collaborationController");

const router = express.Router();

// Create a new form
router.post("/jobforms", formController.createForm);

router.get('/jobforms/all',formController.getAllFormsFormat);

// Update a form's format
router.put("/jobforms", formController.updateFormFormat);

// Get the format of a specific form
router.get("/jobforms/:formId", formController.getFormFormat);

// Get all responses of a form
router.get("/jobforms/:formId/responses", formController.getFormResponses);

module.exports = router;