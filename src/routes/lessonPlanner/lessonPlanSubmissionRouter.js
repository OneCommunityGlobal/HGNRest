const express = require('express');
const multer = require('multer');
const { submitLessonPlan } = require('../../controllers/lessonPlaner/lessonPlanSubmission');

const router = express.Router();

// Allowed file types and max size
const allowedTypes = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
const maxSize = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage(); // Use diskStorage if saving locally
const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (req, file, cb) => {
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return cb(new Error('Unsupported file type'), false);
    }
    cb(null, true);
  },
});

router.post('/submit', upload.single('file'), async (req, res) => {
  try {
    await submitLessonPlan(req, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
