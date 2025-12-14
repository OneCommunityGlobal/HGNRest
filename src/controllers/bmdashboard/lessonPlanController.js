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
    const drafts = await LessonPlan.find({ status: 'draft' })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json(drafts);
  } catch (error) {
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
