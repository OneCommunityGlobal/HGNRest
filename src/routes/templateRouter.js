// src/routes/templateRouter.js

const express = require("express");
const templateController = require("../controllers/templateController");

const router = express.Router();

// Template routes
router.get("/templates", templateController.getAllTemplates);
router.post("/templates", templateController.createTemplate);
router.get("/templates/:id", templateController.getTemplateById);
router.put("/templates/:id", templateController.updateTemplate);
router.delete("/templates/:id", templateController.deleteTemplate);

module.exports = router;