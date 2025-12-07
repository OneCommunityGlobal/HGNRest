const LessonPlan = require('../../models/lessonPlan');

exports.submitLessonPlanDraft = async (req, res) => {
  try {
    const { title, subject, gradeLevel, description, objectives, content } = req.body;

    const draft = await LessonPlan.create({
      title,
      subject,
      gradeLevel,
      description,
      objectives: objectives || [],
      content: content || '',
      createdBy: req.user._id,
      status: 'draft',
      collaborators: [],
    });

    return res.status(201).json({
      message: 'Lesson plan draft submitted successfully.',
      draft,
    });
  } catch (error) {
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
