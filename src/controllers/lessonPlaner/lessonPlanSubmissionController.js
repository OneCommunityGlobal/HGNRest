const LessonPlanSubmission = require('../../models/lessonPlanner/lessonPlanSubmission');

function isValidUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function submitLessonPlan(req, res) {
  const { taskId, link } = req.body;
  const studentId = req.user?.id || req.body.studentId;

  if (!taskId) return res.status(400).json({ error: 'Task ID is required.' });
  if (!studentId) return res.status(400).json({ error: 'Student ID is required.' });

  let submissionLink = '';
  let fileMeta = {};

  if (req.file) {
    submissionLink = req.file.originalname;
    fileMeta = {
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    };
  } else if (link) {
    if (!isValidUrl(link)) {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }
    submissionLink = link;
    fileMeta = { fileType: 'link' };
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
      ...fileMeta,
    });
    res.json({ message: 'Submission successful.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save submission.', details: err.message });
  }
}

const controller = {
  submitLessonPlan,
  isValidUrl,
};

module.exports = controller;