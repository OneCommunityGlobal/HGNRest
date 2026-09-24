const express = require('express');
const lessonPlanDraftController = require('../controllers/lessonPlanDraftController');

const router = express.Router();

router.post('/student/lesson-plan-drafts', lessonPlanDraftController.createLessonPlanDraft);
router.get('/educator/lesson-plan-drafts', lessonPlanDraftController.getLessonPlanDrafts);
router.put('/educator/lesson-plan-drafts/:draftId', lessonPlanDraftController.updateLessonPlanDraft);

module.exports = router;
