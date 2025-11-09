const express = require('express');

const router = express.Router();
const lessonPlanController = require('../../controllers/bmdashboard/lessonPlanController');

// Routes for lesson plans
router.get('/', lessonPlanController.getAllLessonPlans);
router.get('/:id', lessonPlanController.getLessonPlanById);
router.post('/', lessonPlanController.createLessonPlan);
router.put('/:id', lessonPlanController.updateLessonPlan);
router.delete('/:id', lessonPlanController.deleteLessonPlan);

module.exports = router;
