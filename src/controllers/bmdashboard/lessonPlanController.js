const LessonPlan = require('../../models/lessonPlan');

exports.submitLessonPlanDraft = async (req, res) => {
  try {
    const draft = new LessonPlan({
      title: req.body.title,
      subject: req.body.subject,
      gradeLevel: req.body.gradeLevel,
      description: req.body.description,
      objectives: req.body.objectives || [],
      content: req.body.content || '',
      createdBy: req.user._id,
      status: 'draft',
      collaborators: [],
    });

    await draft.save();
    res.status(201).json({
      message: 'Lesson plan draft submitted successfully',
      draft,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getPendingLessonPlanDrafts = async (req, res) => {
  try {
    const drafts = await LessonPlan.find({ status: 'draft' })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(drafts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveOrModifyLessonPlanDraft = async (req, res) => {
  try {
    const { draftId } = req.params;
    const updates = req.body;

    const updatedPlan = await LessonPlan.findByIdAndUpdate(
      draftId,
      {
        ...updates,
        status: 'approved',
        lastEditedBy: req.user._id,
      },
      { new: true },
    );

    if (!updatedPlan) return res.status(404).json({ message: 'Lesson plan draft not found' });

    res.status(200).json({
      message: 'Lesson plan approved and finalized successfully',
      plan: updatedPlan,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
