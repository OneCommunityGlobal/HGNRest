const express = require('express');

const router = express.Router();
const lessonPlanController = require('../../controllers/bmdashboard/lessonPlanController');

router.get('/student/lesson-plan-templates-details', lessonPlanController.lessonPlanDetails);
router.post('/student/lesson-plan-drafts', lessonPlanController.saveLessonPlanDraft);
router.get('/educator/lesson-plan-drafts', lessonPlanController.getPendingLessonPlanDrafts);
router.put(
  '/educator/lesson-plan-drafts/:draftId',
  lessonPlanController.approveOrModifyLessonPlanDraft,
);
router.post('/lesson-plan/save-comments', lessonPlanController.saveComments);

module.exports = router;
