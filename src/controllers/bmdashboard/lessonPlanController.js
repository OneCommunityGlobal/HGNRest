const LessonPlan = require('../../models/lessonPlan');
const LessonPlanTemplate = require('../../models/lessonPlanTemplate');
const Subject = require('../../models/subject');
const Atom = require('../../models/atom');
const LessonPlanDraft = require('../../models/lessonPlanDraft');

exports.lessonPlanDetails = async (req, res) => {
  try {
    const lessonPlans = await LessonPlanTemplate.find().populate({
      path: 'subjectTags',
      select: 'name description atomIds',
      populate: {
        path: 'atomIds',
        select: 'name description',
      },
    });

    if (!lessonPlans || lessonPlans.length === 0) {
      return res.status(404).json({ message: 'No lesson plans found' });
    }

    return res.status(200).json(lessonPlans);
  } catch (error) {
    console.error('Error fetching lesson plans:', error);
    return res.status(500).json({ message: error.message });
  }
};

exports.saveLessonPlanDraft = async (req, res) => {
  try {
    const { templateId, selectedTopics, activities, educatorId, userId, comments } = req.body;

    if (!userId) return res.status(400).json({ message: 'studentId missing' });
    const draft = await LessonPlanDraft.create({
      studentId: userId,
      educatorId,
      templateId,
      selectedTopics,
      activities,
      status: 'drafting',
      comments,
    });

    return res.status(201).json({
      message: 'Draft saved successfully',
      draft,
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message });
  }
};

exports.getPendingLessonPlanDrafts = async (req, res) => {
  try {
    const drafts = await LessonPlanDraft.find({
      status: { $in: ['drafting', 'submitted_to_teacher', 'in_review'] },
    })
      .populate('studentId', 'name email')
      .populate('educatorId', 'name email')
      .populate('templateId', 'name description')
      .populate('selectedTopics', 'name description')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(drafts);
  } catch (error) {
    console.error('Error fetching pending lesson plan drafts:', error);
    return res.status(500).json({ message: error.message });
  }
};

exports.updateLessonPlanDraftStatus = async (req, res) => {
  try {
    const { draftId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    const allowedStatuses = ['drafting', 'submitted_to_teacher', 'in_review', 'approved'];
    if (!allowedStatuses.includes(status)) {
      return res
        .status(400)
        .json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
    }

    const updatedDraft = await LessonPlanDraft.findByIdAndUpdate(
      draftId,
      { status, updatedAt: new Date() },
      { new: true },
    );

    if (!updatedDraft) {
      return res.status(404).json({ message: 'Lesson plan draft not found' });
    }

    return res.status(200).json({
      message: `Lesson plan draft status updated to "${status}" successfully.`,
      draft: updatedDraft,
    });
  } catch (error) {
    console.error('Error updating lesson plan draft status:', error);
    return res.status(500).json({ message: error.message });
  }
};
