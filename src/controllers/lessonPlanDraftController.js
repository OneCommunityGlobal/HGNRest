const LessonPlanDraft = require('../models/lessonPlanDraft');
const { hasPermission } = require('../utilities/permissions');

// Matches the case-variant convention used elsewhere (e.g. taskCommentController.js).
// NOTE: hasPermission() cannot be used for the student check below because no
// 'Student' Role document currently exists in this database, so any
// hasPermission(studentRequestor, ...) call would always resolve to false.
// This mirrors the same constraint already worked around in taskCommentController.js.
const studentRoles = ['student', 'Student'];

/**
 * POST /student/lesson-plan-drafts
 * Student submits a new plan proposal.
 */
exports.createLessonPlanDraft = async (req, res) => {
  try {
    const { requestor } = req.body;

    if (!requestor?.requestorId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!studentRoles.includes(requestor.role)) {
      return res.status(403).json({ message: 'Only students can submit a lesson plan draft' });
    }

    const { goals, topics, suggestedTasks } = req.body;

    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ message: 'At least one topic must be selected' });
    }

    const draft = await LessonPlanDraft.create({
      studentId: requestor.requestorId,
      goals: Array.isArray(goals) ? goals : [],
      topics,
      suggestedTasks: Array.isArray(suggestedTasks) ? suggestedTasks : [],
    });

    return res.status(201).json(draft);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

/**
 * GET /educator/lesson-plan-drafts
 * Educator views pending proposals.
 */
exports.getLessonPlanDrafts = async (req, res) => {
  try {
    const { requestor } = req.body;

    if (!requestor?.requestorId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!(await hasPermission(requestor, 'reviewLessonPlanDrafts'))) {
      return res.status(403).json({ message: 'Only educators can view lesson plan drafts' });
    }

    const drafts = await LessonPlanDraft.find({ status: 'draft' }).sort({ createdAt: 1 });

    return res.status(200).json(drafts);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

/**
 * PUT /educator/lesson-plan-drafts/:draftId
 * Educator approves/modifies the plan, turning it into an active lesson plan.
 */
exports.updateLessonPlanDraft = async (req, res) => {
  try {
    const { requestor } = req.body;

    if (!requestor?.requestorId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!(await hasPermission(requestor, 'reviewLessonPlanDrafts'))) {
      return res.status(403).json({ message: 'Only educators can modify lesson plan drafts' });
    }

    const { draftId } = req.params;
    const draft = await LessonPlanDraft.findById(draftId);

    if (!draft) {
      return res.status(404).json({ message: 'Lesson plan draft not found' });
    }

    const { goals, topics, suggestedTasks, assessmentForms } = req.body;

    if (goals !== undefined) draft.goals = goals;
    if (topics !== undefined) draft.topics = topics;
    if (suggestedTasks !== undefined) draft.suggestedTasks = suggestedTasks;
    if (assessmentForms !== undefined) draft.assessmentForms = assessmentForms;

    draft.educatorId = requestor.requestorId;
    draft.status = 'active';

    await draft.save();

    return res.status(200).json(draft);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};
