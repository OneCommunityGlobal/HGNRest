const express = require('express');
const router = express.Router();

const Educator = require('../models/pmEducators');
const Student  = require('../models/pmStudents');

const {
  getEducators,
  getEducatorById,
  getStudentsByEducator,
  getSubjects,
  searchStudentsAcrossEducators,
} = require('../controllers/pmeducatorsController');

const {
  previewNotification,
  sendNotification,
} = require('../controllers/pmnotificationsController');

// Educators & students
router.get('/educators', getEducators);
router.get('/educators/:educatorId', getEducatorById);
router.get('/educators/:educatorId/students', getStudentsByEducator);

router.get('/subjects', getSubjects);
router.get('/students/search', searchStudentsAcrossEducators);

// Notifications
router.post('/notifications/preview', previewNotification);
router.post('/notifications', sendNotification);

router.post('/seed', async (req, res) => {
  try {
    const eduCount = await Educator.countDocuments();
    const stuCount = await Student.countDocuments();
    if (eduCount > 0 || stuCount > 0) {
      return res.json({ ok: true, skipped: true, eduCount, stuCount });
    }

    const edus = await Educator.insertMany([
      { name: 'Alice Johnson', subject: 'Mathematics' },
      { name: 'Brian Lee',     subject: 'Science' },
      { name: 'John Doe',      subject: 'English' },
    ]);

    const idByName = Object.fromEntries(edus.map((e) => [e.name, e._id]));

    const students = [
      { name: 'Jay',         grade: '7', progress: 0.78, educator: idByName['Alice Johnson'] },
      { name: 'Kate',        grade: '7', progress: 0.62, educator: idByName['Alice Johnson'] },
      { name: 'Sam',         grade: '8', progress: 0.85, educator: idByName['Alice Johnson'] },
      { name: 'Alina Gupta', grade: '6', progress: 0.54, educator: idByName['Brian Lee'] },
      { name: 'Samir Khan',  grade: '6', progress: 0.91, educator: idByName['Brian Lee'] },
      { name: 'Ryan',        grade: '7', progress: 0.73, educator: idByName['John Doe'] },
    ];
    await Student.insertMany(students);

    res.json({ ok: true, educators: edus.length, students: students.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
