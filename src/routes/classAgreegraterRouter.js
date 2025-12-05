const express = require('express');

const router = express.Router();

const {
  computeStudentScore,
  performanceCategory,
  computeGroupPerformance,
} = require('../controllers/ClassAggregation/classAggregationController');

const {
  studentGroupMembers,
  educationStudentProfile,
  studentMetrics,
  studentGroups,
} = require('../controllers/ClassAggregation/mockData');

function getStudentsInClass(classId) {
  return studentGroupMembers.filter((m) => m.groupId === classId).map((m) => m.studentId);
}

function getStudentData(studentId) {
  const profile = educationStudentProfile.find((p) => p.studentId === studentId);
  const metrics = studentMetrics[studentId];

  return {
    studentId,
    profile,
    metrics,
  };
}

// ----------------------
// 1. /educator/reports/class/:classId
// ----------------------
router.get('/class/:classId', (req, res) => {
  const { classId } = req.params;

  // Validate classId
  const group = studentGroups.find((g) => g.groupId === classId);
  if (!group) {
    return res.status(404).json({ error: 'Class not found' });
  }

  const studentIds = getStudentsInClass(classId);

  const students = studentIds.map((studentId) => {
    const { profile, metrics } = getStudentData(studentId);
    const score = computeStudentScore(studentId);

    return {
      studentId,
      educator: profile?.educator,
      progressSummary: profile?.progressSummary,
      subjects: profile?.subjects,
      metrics,
      score,
      performance: performanceCategory(score),
    };
  });

  const classPerformance = computeGroupPerformance(classId);

  return res.json({
    classId,
    className: group.groupName,
    totalStudents: students.length,
    classPerformance,
    performanceCategory: performanceCategory(classPerformance),
    students,
  });
});

module.exports = router;
