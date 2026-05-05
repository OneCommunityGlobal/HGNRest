const express = require('express');

const router = express.Router();
const progressController = require('../controllers/progressController')();

// Educator endpoint - get student progress with molecules visualization data
router.get('/educator/student-progress/:studentId', progressController.getEducatorStudentProgress);

// Get all progress records
router.get('/', progressController.getProgress);

// Get progress by student
router.get('/student/:studentId', progressController.getProgressByStudent);

// Get progress by atom
router.get('/atom/:atomId', progressController.getProgressByAtom);

// Get progress by status
router.get('/status/:status', progressController.getProgressByStatus);

// Get student progress summary
router.get('/summary/:studentId', progressController.getStudentProgressSummary);

// Get specific progress record
router.get('/:id', progressController.getProgressById);

// Get progress by student and atom
router.get('/student/:studentId/atom/:atomId', progressController.getProgressByStudentAndAtom);

// Create new progress record
router.post('/', progressController.createProgress);

// Update progress
router.patch('/:id', progressController.updateProgress);

// Delete progress
router.delete('/:id', progressController.deleteProgress);

// Update progress status
router.patch('/:id/status', progressController.updateProgressStatus);

// Grade progress
router.patch('/:id/grade', progressController.gradeProgress);

module.exports = router;
