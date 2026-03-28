const mongoose = require('mongoose');
const Progress = require('../models/progress');
const UserProfile = require('../models/userProfile');
const EducationTask = require('../models/educationTask');
const LessonPlan = require('../models/lessonPlan');

const studentReportController = function () {
  // --- Helper Functions (Logic remains the same, just keeping them organized) ---

  function calculateTaskStatistics(tasks) {
    const byStatus = {
      assigned: tasks.filter((t) => t.status === 'assigned').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      graded: tasks.filter((t) => t.status === 'graded').length,
    };

    const byType = {
      read: tasks.filter((t) => t.type === 'read').length,
      write: tasks.filter((t) => t.type === 'write').length,
      practice: tasks.filter((t) => t.type === 'practice').length,
      quiz: tasks.filter((t) => t.type === 'quiz').length,
      project: tasks.filter((t) => t.type === 'project').length,
    };

    const totalHoursLogged = tasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);
    return {
      byStatus,
      byType,
      totalHoursLogged,
      avgHoursPerTask: tasks.length > 0 ? totalHoursLogged / tasks.length : 0,
    };
  }

  function calculateProgressStats(progress) {
    const completed = progress.filter((p) => p.status === 'completed');
    const grades = progress
      .filter((p) => p.grade && p.grade !== 'pending')
      .map((p) => {
        const gradeMap = { A: 4, B: 3, C: 2, D: 1, F: 0 };
        return gradeMap[p.grade] || 0;
      });

    return {
      totalAttempts: progress.length,
      completedAttempts: completed.length,
      completionRate:
        progress.length > 0 ? Math.round((completed.length / progress.length) * 100) : 0,
      averageScore:
        grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2) : 0,
      gradeDistribution: {
        A: progress.filter((p) => p.grade === 'A').length,
        B: progress.filter((p) => p.grade === 'B').length,
        C: progress.filter((p) => p.grade === 'C').length,
        D: progress.filter((p) => p.grade === 'D').length,
        F: progress.filter((p) => p.grade === 'F').length,
      },
    };
  }

  function calculateAverageGrade(tasks) {
    const gradedTasks = tasks.filter((t) => t.grade && t.grade !== 'pending');
    if (gradedTasks.length === 0) return 'N/A';
    const gradeMap = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    const average =
      gradedTasks.reduce((sum, t) => sum + (gradeMap[t.grade] || 0), 0) / gradedTasks.length;
    const gradeScale = { 4: 'A', 3: 'B', 2: 'C', 1: 'D', 0: 'F' };
    return gradeScale[Math.round(average)] || 'N/A';
  }

  function getLessonCompletionSummary(tasks) {
    const lessonMap = {};
    tasks.forEach((task) => {
      const lessonId = task.lessonPlanId?._id;
      if (!lessonId) return;
      if (!lessonMap[lessonId]) {
        lessonMap[lessonId] = {
          lessonId,
          title: task.lessonPlanId.title,
          theme: task.lessonPlanId.theme,
          totalTasks: 0,
          completedTasks: 0,
        };
      }
      lessonMap[lessonId].totalTasks += 1;
      if (['completed', 'graded'].includes(task.status)) {
        lessonMap[lessonId].completedTasks += 1;
      }
    });

    return Object.values(lessonMap).map((lesson) => ({
      ...lesson,
      completionPercentage:
        lesson.totalTasks > 0 ? Math.round((lesson.completedTasks / lesson.totalTasks) * 100) : 0,
    }));
  }

  function buildProgressTimeline(tasks, progress) {
    const combined = [
      ...tasks.map((t) => ({
        type: 'task',
        date: t.completedAt || t.assignedAt,
        title: t.type,
        status: t.status,
      })),
      ...progress.map((p) => ({
        type: 'progress',
        date: p.lastUpdated,
        title: p.atomId?.name || 'Progress Update',
        status: p.status,
      })),
    ];
    return combined.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
  }

  // --- Core Data Builder (The Single Source of Truth) ---

  async function buildStudentReportData(studentId, startDate, endDate) {
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const [tasks, progress, student] = await Promise.all([
      EducationTask.find({ studentId, ...dateFilter })
        .populate('lessonPlanId', 'title theme')
        .populate('atomIds', 'name')
        .lean(),
      Progress.find({ studentId, ...dateFilter })
        .populate('atomId', 'name')
        .lean(),
      UserProfile.findById(studentId).select('firstName lastName email grade role').lean(),
    ]);

    if (!student) return null;

    const taskStats = calculateTaskStatistics(tasks);
    const progressStats = calculateProgressStats(progress);

    const report = {
      studentInfo: {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        grade: student.grade,
        role: student.role,
      },
      reportPeriod: {
        startDate: startDate || 'All Time',
        endDate: endDate || 'Present',
        generatedAt: new Date(),
      },
      taskPerformance: taskStats,
      progressMetrics: progressStats,
      lessonCompletionSummary: getLessonCompletionSummary(tasks),
      overallPerformanceSummary: {
        totalTasksAssigned: tasks.length,
        totalTasksCompleted: tasks.filter((t) => ['completed', 'graded'].includes(t.status)).length,
        averageGrade: calculateAverageGrade(tasks),
        completionPercentage:
          tasks.length > 0
            ? Math.round(
                (tasks.filter((t) => ['completed', 'graded'].includes(t.status)).length /
                  tasks.length) *
                  100,
              )
            : 0,
        averageAssessmentScore: progressStats.averageScore,
      },
      timeline: buildProgressTimeline(tasks, progress),
    };

    return { report, tasks, progress };
  }

  // --- Route Handlers (Now very slim) ---

  const getStudentReport = async (req, res) => {
    try {
      const { studentId } = req.params;
      const { startDate, endDate } = req.query;

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ error: 'Invalid Student ID' });
      }

      const data = await buildStudentReportData(studentId, startDate, endDate);
      if (!data) return res.status(404).json({ error: 'Student not found' });

      res.status(200).json(data.report);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate report' });
    }
  };

  const getStudentReportExport = async (req, res) => {
    try {
      const { studentId } = req.params;
      const { startDate, endDate, format = 'json' } = req.query;

      const data = await buildStudentReportData(studentId, startDate, endDate);
      if (!data) return res.status(404).json({ error: 'Student not found' });

      const exportData = {
        ...data.report,
        tasks: data.tasks.map((t) => ({
          id: t._id,
          type: t.type,
          status: t.status,
          grade: t.grade,
        })),
        progress: data.progress.map((p) => ({ id: p._id, atom: p.atomId?.name, status: p.status })),
      };

      res.status(200).json({ success: true, format, data: exportData });
    } catch (error) {
      res.status(500).json({ error: 'Failed to export report' });
    }
  };

  return { getStudentReport, getStudentReportExport };
};

module.exports = studentReportController;
