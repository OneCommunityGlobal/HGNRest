const LessonPlan = require('../../models/lessonPlan');
const LessonPlanTemplate = require('../../models/lessonPlanTemplate');
const Subject = require('../../models/subject');
const Atom = require('../../models/atom');
const LessonPlanDraft = require('../../models/lessonPlanDraft');
const LessonPlanComment = require('../../models/lessonPlanComment');

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
    const { templateId, selectedTopics, activities, educatorId } = req.body;

    const draft = await LessonPlanDraft.create({
      studentId: req.user._id,
      educatorId,
      templateId,
      selectedTopics,
      activities,
      status: 'drafting',
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
    const lessonPlans = await LessonPlan.find({ status: 'draft' })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    if (!lessonPlans.length) {
      return res.status(200).json([]);
    }

    const lessonPlanIds = lessonPlans.map((lp) => lp._id);

    const drafts = await LessonPlanDraft.find({
      lessonPlanId: { $in: lessonPlanIds },
    }).lean();

    const draftIds = drafts.map((d) => d._id);

    const comments = await LessonPlanComment.find({
      draftId: { $in: draftIds },
    })
      .populate('userId', 'name email')
      .populate('itemId')
      .lean();

    const commentsByLessonPlanId = {};

    drafts.forEach((draft) => {
      commentsByLessonPlanId[draft.lessonPlanId] = commentsByLessonPlanId[draft.lessonPlanId] || [];

      comments
        .filter((c) => c.draftId.toString() === draft._id.toString())
        .forEach((c) => commentsByLessonPlanId[draft.lessonPlanId].push(c));
    });

    const response = lessonPlans.map((plan) => ({
      ...plan,
      comments: commentsByLessonPlanId[plan._id] || [],
    }));

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching pending lesson plan drafts:', error);
    return res.status(500).json({ message: error.message });
  }
};

exports.approveOrModifyLessonPlanDraft = async (req, res) => {
  try {
    const { draftId } = req.params;
    const updatePayload = req.body;

    const updatedPlan = await LessonPlan.findByIdAndUpdate(
      draftId,
      {
        ...updatePayload,
        status: 'approved',
        lastEditedBy: req.user._id,
        $push: {
          versionHistory: {
            editedBy: req.user._id,
            changes: JSON.stringify(updatePayload),
            updatedAt: new Date(),
          },
        },
      },
      { new: true },
    );

    if (!updatedPlan) {
      return res.status(404).json({ message: 'Lesson plan draft not found' });
    }

    return res.status(200).json({
      message: 'Lesson plan approved and finalized successfully.',
      plan: updatedPlan,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.saveComments = async (req, res) => {
  try {
    const { draftId, itemId, comment } = req.body;

    const newComment = await LessonPlanComment.create({
      userId: req.user._id,
      draftId,
      itemId,
      comment,
    });

    return res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(400).json({ message: error.message });
  }
};
