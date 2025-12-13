const mongoose = require('mongoose');
const Progress = require('../models/progress');
const UserProfile = require('../models/userProfile');
const EducationTask = require('../models/educationTask');
const LessonPlan = require('../models/lessonPlan');
const { hasPermission } = require('../utilities/permissions');

const studentReportController = function () {
  // Helper Functions
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
    const avgHoursPerTask = tasks.length > 0 ? totalHoursLogged / tasks.length : 0;

    return {
      byStatus,
      byType,
      totalHoursLogged,
      avgHoursPerTask,
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
    const completionRate =
      progress.length > 0 ? Math.round((completed / progress.length) * 100) : 0;
    const averageScore =
      grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2) : 0;

    return {
      totalAttempts: progress.length,
      completedAttempts: completed.length,
      completionRate,
      averageScore,
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

  function getLessonCompletionSummary(tasks, lessonPlans) {
    const lessonMap = {};

    tasks.forEach((task) => {
      const lessonId = task.lessonPlanId._id;
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
      if (task.status === 'completed' || task.status === 'graded') {
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

  async function buildStudentReportData(studentId, startDate, endDate) {
    const dateFilter = {};

    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const tasks = await EducationTask.find({
      studentId,
      ...dateFilter,
    })
      .populate('lessonPlanId', 'title theme startDate endDate')
      .populate('atomIds', 'name description difficulty')
      .lean();

    const taskStats = calculateTaskStatistics(tasks);

    const progress = await Progress.find({
      studentId,
      ...dateFilter,
    })
      .populate('atomId', 'name description difficulty')
      .lean();

    const progressStats = calculateProgressStats(progress);

    const lessonPlans = await LessonPlan.find({
      _id: { $in: tasks.map((t) => t.lessonPlanId) },
    }).lean();

    const report = {
      studentInfo: null,
      reportPeriod: {
        startDate: startDate || 'All Time',
        endDate: endDate || 'Present',
        generatedAt: new Date(),
      },
      taskPerformance: taskStats,
      progressMetrics: progressStats,
      lessonCompletionSummary: getLessonCompletionSummary(tasks, lessonPlans),
      overallPerformanceSummary: {
        totalTasksAssigned: tasks.length,
        totalTasksCompleted: tasks.filter((t) => t.status === 'completed' || t.status === 'graded')
          .length,
        averageGrade: calculateAverageGrade(tasks),
        completionPercentage:
          tasks.length > 0
            ? Math.round(
                (tasks.filter((t) => t.status === 'completed' || t.status === 'graded').length /
                  tasks.length) *
                  100,
              )
            : 0,
        averageAssessmentScore: progressStats.averageScore,
      },
      timeline: buildProgressTimeline(tasks, progress),
    };

    return { report, tasks, progress, lessonPlans };
  }

  // GET /educator/reports/student/:studentId

  const getStudentReport = async (req, res) => {
    try {
      const { studentId } = req.params;
      const { startDate, endDate } = req.query;

      // const hasAccess = await hasPermission(requestor, 'viewStudentReports');
      // if (!hasAccess && requestor.role !== 'Educator' && requestor.role !== 'Program Manager') {
      //   return res.status(403).json({
      //     error: 'Insufficient permissions. Only educators and program managers can access student reports.',
      //   });
      // }

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ error: 'Student ID not Found' });
      }

      const student = await UserProfile.findById(studentId).select(
        'firstName lastName email grade role',
      );

      if (!student) {
        return res.status(400).json({ error: 'Student Details not found' });
      }

      // Date Filter
      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      // tasks with data
      const tasks = await EducationTask.find({
        studentId,
        ...dateFilter,
      })
        .populate('lessonPlanId', 'title theme startDate endDate')
        .populate('atomIds', 'name description difficulty')
        .lean();

      const taskStats = calculateTaskStatistics(tasks);

      const progress = await Progress.find({
        studentId,
        ...dateFilter,
      })
        .populate('atomId', 'name description difficulty')
        .lean();

      const progressStats = calculateProgressStats(progress);

      const lessonPlans = await LessonPlan.find({
        _id: { $in: tasks.map((t) => t.lessonPlanId) },
      }).lean();

      const { report } = await buildStudentReportData(studentId, startDate, endDate);

      report.studentInfo = {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        grade: student.grade,
        role: student.role,
      };

      res.status(200).json(report);
    } catch (error) {
      console.error('Error generating student report:', error);
      res.status(500).json({ error: 'Failed to generate student report' });
    }
  };

  // GET /educator/reports/student/:studentId/export
  const getStudentReportExport = async (req, res) => {
    try {
      const { studentId } = req.params;
      const { startDate, endDate, format = 'json' } = req.query;

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ error: 'Student ID not Found' });
      }

      const student = await UserProfile.findById(studentId).select(
        'firstName lastName email grade role',
      );

      if (!student) {
        return res.status(400).json({ error: 'Student Details not found' });
      }

      const { report, tasks, progress } = await buildStudentReportData(
        studentId,
        startDate,
        endDate,
      );
      report.studentInfo = {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        grade: student.grade,
        role: student.role,
      };

      const exportData = {
        studentInfo: report.studentInfo,
        reportPeriod: report.reportPeriod,
        summary: report.overallPerformanceSummary,
        taskPerformance: report.taskPerformance,
        progressMetrics: report.progressMetrics,
        lessonCompletionSummary: report.lessonCompletionSummary,
        timeline: report.timeline,
        tasks: tasks.map((task) => ({
          id: task._id,
          lessonPlan: task.lessonPlanId?.title || 'N/A',
          type: task.type,
          status: task.status,
          assignedDate: task.assignedAt,
          dueDate: task.dueAt,
          completedDate: task.completedAt,
          grade: task.grade,
          feedback: task.feedback,
        })),
        progress: progress.map((p) => ({
          id: p._id,
          atom: p.atomId?.name || 'N/A',
          status: p.status,
          grade: p.grade,
          lastUpdated: p.lastUpdated,
        })),
      };

      if (format === 'pdf') {
        return res.status(200).json({
          success: true,
          format: 'pdf-ready',
          data: exportData,
          message: 'PDF-ready payload returned. Use PDF generator to render',
        });
      }

      return res.status(200).json({
        success: true,
        format: 'json',
        data: exportData,
      });
    } catch (error) {
      console.log('Error exporting student report:', error);
      res.status(500).json({ error: 'Failed to export student report' });
    }
  };

  return {
    getStudentReport,
    getStudentReportExport,
  };
};

module.exports = studentReportController;
