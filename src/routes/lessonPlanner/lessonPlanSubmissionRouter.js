const express = require('express');
const multer = require('multer');
const { submitLessonPlan } = require('../../controllers/lessonPlaner/lessonPlanSubmissionController');

const router = express.Router();

const allowedTypes = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
const maxSize = 10 * 1024 * 1024;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (req, file, cb) => {
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return cb(new Error('Unsupported file type. Allowed: ' + allowedTypes.join(', ')), false);
    }
    cb(null, true);
  },
});

router.post('/submit', upload.single('file'), async (req, res) => {
  try {
    await submitLessonPlan(req, res);
  } catch (err) {
    res.status(400).json({
      error: err.message || 'Unknown error during submission.',
      code: err.code || 'UPLOAD_ERROR',
    });
  }
});

module.exports = router;