const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const Notification = require('../models/notification');
const StudentEvaluation = require('../models/studentEvaluation');
const EvaluationTask = require('../models/evaluationTask');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const EXCELLENT_THRESHOLD = 85;
const PROFICIENT_THRESHOLD = 70;
const DEVELOPING_THRESHOLD = 50;

const PERFORMANCE_COLORS = {
  excellent: '#1F9D55',
  outstanding: '#1F9D55',
  advanced: '#1F9D55',
  proficient: '#2F80ED',
  good: '#2F80ED',
  satisfactory: '#F2C94C',
  developing: '#F2994A',
  needs_improvement: '#EB5757',
  needsimprovement: '#EB5757',
  at_risk: '#EB5757',
  poor: '#EB5757',
};

function normalizePercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function getPerformanceColor(performanceLevel, percentage) {
  const normalizedLevel = String(performanceLevel || '')
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (PERFORMANCE_COLORS[normalizedLevel]) {
    return PERFORMANCE_COLORS[normalizedLevel];
  }

  if (percentage >= EXCELLENT_THRESHOLD) return '#1F9D55';
  if (percentage >= PROFICIENT_THRESHOLD) return '#2F80ED';
  if (percentage >= DEVELOPING_THRESHOLD) return '#F2C94C';
  return '#EB5757';
}

function getAggregatePerformanceLevel(percentage) {
  if (percentage >= EXCELLENT_THRESHOLD) return 'Excellent';
  if (percentage >= PROFICIENT_THRESHOLD) return 'Proficient';
  if (percentage >= DEVELOPING_THRESHOLD) return 'Developing';
  return 'Needs Improvement';
}

function getSubmissionStatus(task) {
  if (!task.submissionDate || !task.dueDate) {
    return 'pending';
  }

  return new Date(task.submissionDate) <= new Date(task.dueDate) ? 'on_time' : 'late';
}

function buildTaskResult(task) {
  return {
    taskId: task._id,
    taskName: task.taskName,
    weightage: task.weightage,
    marks: task.marks,
    percentage: normalizePercentage(task.percentage),
    status: task.status,
    feedback: task.feedback,
    dueDate: task.dueDate,
    submissionDate: task.submissionDate,
    submissionStatus: getSubmissionStatus(task),
    performanceColor: getPerformanceColor(null, task.percentage),
  };
}

function buildCategoryResult(evaluation, categoryTasks) {
  return {
    evaluationId: evaluation._id,
    category: evaluation.category,
    weightage: evaluation.weightage,
    totalItems: evaluation.totalItems,
    completedItems: evaluation.completedItems,
    marks: evaluation.marks,
    percentage: normalizePercentage(evaluation.percentage),
    performanceLevel: evaluation.performanceLevel,
    performanceColor: getPerformanceColor(evaluation.performanceLevel, evaluation.percentage),
    feedback: evaluation.feedback,
    createdAt: evaluation.createdAt,
    updatedAt: evaluation.updatedAt,
    tasks: categoryTasks.map(buildTaskResult),
  };
}

function summarizeCategoryTasks(tasks) {
  return tasks.reduce(
    (summary, task) => {
      const isCompleted = ['completed', 'graded', 'submitted'].includes(
        String(task.status || '').toLowerCase(),
      );

      if (isCompleted) {
        summary.completedTasks += 1;
      }

      const submissionStatus = getSubmissionStatus(task);
      if (submissionStatus === 'on_time') {
        summary.onTimeSubmissions += 1;
      }
      if (submissionStatus === 'late') {
        summary.lateSubmissions += 1;
      }

      return summary;
    },
    {
      completedTasks: 0,
      onTimeSubmissions: 0,
      lateSubmissions: 0,
    },
  );
}

async function getValidatedStudent(studentId) {
  if (!isValidObjectId(studentId)) {
    throw new Error('Invalid student ID provided.');
  }

  const student = await UserProfile.findById(studentId)
    .select('firstName lastName role educationProfiles.student.lastEvaluationResultsViewedAt')
    .lean();

  if (!student || !student.educationProfiles || !student.educationProfiles.student) {
    throw new Error('Student profile not found.');
  }

  return student;
}

async function getStudentEvaluationResults(studentId) {
  await getValidatedStudent(studentId);

  const evaluations = await StudentEvaluation.find({ studentId })
    .sort({ updatedAt: -1, category: 1 })
    .lean();

  if (!evaluations.length) {
    return {
      summary: {
        overallScore: 0,
        totalCategories: 0,
        totalTasks: 0,
        completedTasks: 0,
        onTimeSubmissions: 0,
        lateSubmissions: 0,
        performanceLevel: 'No Results',
        performanceColor: '#9CA3AF',
        lastPublishedAt: null,
      },
      categories: [],
      taskResults: [],
    };
  }

  const evaluationIds = evaluations.map((evaluation) => evaluation._id);
  const tasks = await EvaluationTask.find({ evaluationId: { $in: evaluationIds } })
    .sort({ dueDate: 1, createdAt: 1 })
    .lean();

  const tasksByEvaluationId = tasks.reduce((accumulator, task) => {
    const key = task.evaluationId.toString();
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(task);
    return accumulator;
  }, {});

  let weightedMarks = 0;
  let totalWeightage = 0;
  let totalTasks = 0;
  let completedTasks = 0;
  let onTimeSubmissions = 0;
  let lateSubmissions = 0;

  const categories = evaluations.map((evaluation) => {
    const categoryTasks = tasksByEvaluationId[evaluation._id.toString()] || [];
    const taskSummary = summarizeCategoryTasks(categoryTasks);
    totalTasks += categoryTasks.length;
    completedTasks += taskSummary.completedTasks;
    onTimeSubmissions += taskSummary.onTimeSubmissions;
    lateSubmissions += taskSummary.lateSubmissions;

    weightedMarks += normalizePercentage(evaluation.percentage) * Number(evaluation.weightage || 0);
    totalWeightage += Number(evaluation.weightage || 0);

    return buildCategoryResult(evaluation, categoryTasks);
  });

  const overallScore =
    totalWeightage > 0
      ? Number((weightedMarks / totalWeightage).toFixed(2))
      : Number(
          (
            categories.reduce((sum, category) => sum + Number(category.percentage || 0), 0) /
            categories.length
          ).toFixed(2),
        );

  return {
    summary: {
      overallScore,
      totalCategories: categories.length,
      totalTasks,
      completedTasks,
      onTimeSubmissions,
      lateSubmissions,
      performanceLevel: getAggregatePerformanceLevel(overallScore),
      performanceColor: getPerformanceColor(null, overallScore),
      lastPublishedAt: categories.reduce((latest, category) => {
        if (!latest || new Date(category.updatedAt) > new Date(latest)) {
          return category.updatedAt;
        }
        return latest;
      }, null),
    },
    categories,
    taskResults: categories.flatMap((category) =>
      category.tasks.map((task) => ({
        ...task,
        evaluationId: category.evaluationId,
        category: category.category,
      })),
    ),
  };
}

async function getEvaluationResultNotifications(studentId) {
  const student = await getValidatedStudent(studentId);
  const lastViewedAt = student.educationProfiles.student.lastEvaluationResultsViewedAt || null;

  const notifications = await Notification.find({
    recipient: studentId,
    type: 'evaluation_results',
  })
    .sort({ createdTimeStamps: -1 })
    .lean();

  const latestNotification = notifications[0] || null;
  const hasNewResults = notifications.some((notification) => {
    if (!lastViewedAt) return true;
    return new Date(notification.createdTimeStamps) > new Date(lastViewedAt);
  });

  return {
    hasNewResults,
    unreadCount: notifications.filter((notification) => !notification.isRead).length,
    lastViewedAt,
    latestNotificationAt: latestNotification ? latestNotification.createdTimeStamps : null,
  };
}

async function markEvaluationResultsViewed(studentId, viewedAt = new Date()) {
  const updatedStudent = await UserProfile.findByIdAndUpdate(
    studentId,
    {
      $set: {
        'educationProfiles.student.lastEvaluationResultsViewedAt': viewedAt,
      },
    },
    {
      new: true,
    },
  );

  await Notification.updateMany(
    {
      recipient: studentId,
      type: 'evaluation_results',
      isRead: false,
    },
    {
      $set: { isRead: true },
    },
  );

  return updatedStudent;
}

async function publishStudentEvaluationResults({
  studentId,
  teacherId,
  evaluations,
  message = 'New evaluation results are available.',
}) {
  await getValidatedStudent(studentId);

  const persistedEvaluations = await Promise.all(
    evaluations.map(async (evaluation) => {
      const persistedEvaluation = await StudentEvaluation.findOneAndUpdate(
        {
          studentId,
          category: evaluation.category,
        },
        {
          $set: {
            weightage: evaluation.weightage,
            totalItems: evaluation.totalItems,
            completedItems: evaluation.completedItems,
            marks: evaluation.marks,
            percentage: normalizePercentage(evaluation.percentage),
            performanceLevel: evaluation.performanceLevel,
            feedback: evaluation.feedback,
            publishedBy: teacherId,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      if (Array.isArray(evaluation.tasks)) {
        await EvaluationTask.deleteMany({ evaluationId: persistedEvaluation._id });

        if (evaluation.tasks.length) {
          await EvaluationTask.insertMany(
            evaluation.tasks.map((task) => ({
              evaluationId: persistedEvaluation._id,
              taskName: task.taskName,
              weightage: task.weightage,
              marks: task.marks,
              percentage: normalizePercentage(task.percentage),
              status: task.status,
              feedback: task.feedback,
              dueDate: task.dueDate,
              submissionDate: task.submissionDate,
            })),
          );
        }
      }

      return persistedEvaluation;
    }),
  );

  await Notification.create({
    message,
    sender: teacherId,
    recipient: studentId,
    type: 'evaluation_results',
    metadata: {
      categories: persistedEvaluations.map((evaluation) => evaluation.category),
    },
    isSystemGenerated: false,
  });

  await UserProfile.findByIdAndUpdate(studentId, {
    $set: {
      'educationProfiles.student.lastEvaluationResultsViewedAt': null,
    },
  });

  return persistedEvaluations;
}

module.exports = {
  getPerformanceColor,
  getStudentEvaluationResults,
  getEvaluationResultNotifications,
  markEvaluationResultsViewed,
  publishStudentEvaluationResults,
};
