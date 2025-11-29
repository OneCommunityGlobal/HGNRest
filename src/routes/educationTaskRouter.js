const express = require('express');

const router = express.Router();
const educationTaskController = require('../controllers/educationTaskController');

// Initialize controller
const controller = educationTaskController();

// Routes
router.get('/', controller.getEducationTasks);
router.get('/student/:studentId', controller.getTasksByStudent);
router.get('/lesson-plan/:lessonPlanId', controller.getTasksByLessonPlan);
router.get('/status/:status', controller.getTasksByStatus);
router.get('/:id', controller.getTaskById);
router.post('/', controller.createTask);
router.put('/:id', controller.updateTask);
router.delete('/:id', controller.deleteTask);
router.patch('/:id/status', controller.updateTaskStatus);
router.patch('/:id/grade', controller.gradeTask);

// Student routes
router.post('/student/mark-complete', controller.markTaskAsComplete);

module.exports = router;
