const express = require("express");
const Question = require("../models/Question");

const router = express.Router();

// GET all questions or filtered questions according to the pages and title
router.get("/", async (req, res) => {
  try {
    const { page, title } = req.query; // Retrieve query parameters
    const query = {};

    if (page) query.page = Number(page); // Add page filter if provided
    if (title) query.title = title; // Add title filter if provided

    const questions = await Question.find(query); // Fetch matching questions
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new question
router.post("/", async (req, res) => {
  const { text, page, title } = req.body;

  if (!text || !page || !title) {
    return res
      .status(400)
      .json({ error: "All fields (text, page, title) are required" });
  }

  try {
    const question = new Question({ text, page, title });
    await question.save();
    res.status(201).json(question);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to create question: " + err.message });
  }
});

// PUT (update) an existing question by ID
router.put("/:id", async (req, res) => {
  const { text, page, title } = req.body;

  try {
    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      { text, page, title },
      { new: true }
    );

    if (!updatedQuestion) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json(updatedQuestion);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to update question: " + err.message });
  }
});

// DELETE an existing question by ID
router.delete("/:id", async (req, res) => {
  try {
    const deletedQuestion = await Question.findByIdAndDelete(req.params.id);

    if (!deletedQuestion) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({ message: "Question deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to delete question: " + err.message });
  }
});

module.exports = router;
