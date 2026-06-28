// routes/classAggregationRouter.js
const express = require('express');

const mongoose = require('mongoose');

const router = express.Router();
const {
  computeStudentScore,
  performanceCategory,
  computeGroupPerformance,
} = require('../controllers/ClassAggregation/classAggregationController');

// ---------------------- Helpers ----------------------
async function getStudentsInClass(classId) {
  const { db } = mongoose.connection;
  const members = await db
    .collection('studentgroupmembers')
    .find({ groupId: new mongoose.Types.ObjectId(classId) })
    .toArray();
  return members.map(({ studentId }) => studentId);
}

async function getStudentData(studentId) {
  const { db } = mongoose.connection;
  const profile = await db
    .collection('education_student_profiles')
    .findOne({ _id: new mongoose.Types.ObjectId(studentId) });
  const metrics = await db
    .collection('studentMetrics')
    .findOne({ studentId: new mongoose.Types.ObjectId(studentId) });
  return { profile, metrics: metrics?.metrics || null };
}

// ---------------------- GET /educator/reports/class/:classId ----------------------
router.get('/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const { db } = mongoose.connection;

    const group = await db
      .collection('studentgroups')
      .findOne({ _id: new mongoose.Types.ObjectId(classId) });
    if (!group) return res.status(404).json({ error: 'Class not found' });

    const studentIds = await getStudentsInClass(classId);

    const students = await Promise.all(
      studentIds.map(async (studentId) => {
        const { profile, metrics } = await getStudentData(studentId);
        const score = await computeStudentScore(studentId);

        return {
          studentId,
          educator: profile?.educator,
          progressSummary: profile?.progressSummary,
          subjects: profile?.subjects,
          metrics,
          score,
          performance: performanceCategory(score),
        };
      }),
    );

    const classPerformance = await computeGroupPerformance(classId);

    res.json({
      classId,
      className: group.name,
      totalStudents: students.length,
      classPerformance,
      performanceCategory: performanceCategory(classPerformance),
      students,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
