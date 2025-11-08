const LessonPlan = require('../../models/lessonPlan');

// Get all lesson plans
exports.getAllLessonPlans = async (req, res) => {
  try {
    const plans = await LessonPlan.find().populate('createdBy', 'name');
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single lesson plan by ID
exports.getLessonPlanById = async (req, res) => {
  try {
    const plan = await LessonPlan.findById(req.params.id).populate('collaborators.userId', 'name');
    if (!plan) return res.status(404).json({ message: 'Lesson plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new lesson plan
exports.createLessonPlan = async (req, res) => {
  try {
    const plan = new LessonPlan({
      title: req.body.title,
      subject: req.body.subject,
      gradeLevel: req.body.gradeLevel,
      description: req.body.description,
      objectives: req.body.objectives,
      content: req.body.content,
      createdBy: req.user._id,
      collaborators: req.body.collaborators || [],
    });
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a lesson plan collaboratively
exports.updateLessonPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const plan = await LessonPlan.findByIdAndUpdate(
      id,
      { ...updates, lastEditedBy: req.user._id },
      { new: true },
    );
    if (!plan) return res.status(404).json({ message: 'Lesson plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a lesson plan
exports.deleteLessonPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await LessonPlan.findByIdAndDelete(id);
    if (!plan) return res.status(404).json({ message: 'Lesson plan not found' });
    res.json({ message: 'Lesson plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
