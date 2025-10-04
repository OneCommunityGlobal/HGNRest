const LessonPlanSubmission = require('../../models/lessonPlanner/lessonPlanSubmission');

exports.submitLessonPlan = async (req, res) => {
  const { taskId, link } = req.body;
  const studentId = req.user?.id || req.body.studentId;

  if (!taskId) return res.status(400).json({ error: 'Task ID is required.' });

  let submissionLink = '';
  const fileUrl = '';

  if (req.file) {
    submissionLink = fileUrl;
  } else if (link) {
    submissionLink = link;
  } else {
    return res.status(400).json({ error: 'Either file or link is required.' });
  }

  try {
    await LessonPlanSubmission.create({
      taskId,
      studentId,
      submissionLink,
      status: 'Submitted',
      submissionTime: new Date(),
    });
    res.json({ message: 'Submission successful.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save submission.' });
  }
};
