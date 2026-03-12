/* istanbul ignore file */
// eslint-disable-next-line import/no-unresolved
const PDFDocument = require('pdfkit');
// eslint-disable-next-line import/no-unresolved
const { Parser } = require('json2csv');
const mongoose = require('mongoose');
const EducationTask = require('../../models/educationTask');
const UserProfile = require('../../models/userProfile');

const REPORT_TYPES = ['student', 'class'];
const REPORT_FORMATS = ['pdf', 'csv'];
const MAX_RECORDS_PER_REPORT = 10000;

// Grade configuration constants
const GRADE_MAP = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 };
const GRADE_THRESHOLD_A = 3.5;
const GRADE_THRESHOLD_B = 2.5;
const GRADE_THRESHOLD_C = 1.5;
const GRADE_THRESHOLD_D = 0.5;

// PDF styling constants
const FONT_SIZE_TITLE = 24;
const FONT_SIZE_METADATA = 10;
const FONT_SIZE_SECTION_HEADER = 16;
const FONT_SIZE_SUBSECTION = 14;
const FONT_SIZE_BODY = 11;
const FONT_SIZE_DETAIL = 10;
const PAGE_BREAK_THRESHOLD = 700;

function validateReportRequest(query) {
  const { type, format, studentId, classId } = query;
  const errors = [];

  if (!type || !REPORT_TYPES.includes(type)) {
    errors.push(`Invalid type. Must be one of: ${REPORT_TYPES.join(', ')}`);
  }

  if (!format || !REPORT_FORMATS.includes(format)) {
    errors.push(`Invalid format. Must be one of: ${REPORT_FORMATS.join(', ')}`);
  }

  if (type === 'student' && !studentId) {
    errors.push('studentId is required for student reports');
  }

  if (type === 'class' && !classId) {
    errors.push('classId is required for class reports');
  }

  // Validate ObjectId format
  if (type === 'student' && studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
    errors.push('Invalid studentId format');
  }

  if (type === 'class' && classId && !mongoose.Types.ObjectId.isValid(classId)) {
    errors.push('Invalid classId format');
  }

  return errors;
}

function buildTaskQuery(type, params) {
  const { studentId, classId, startDate, endDate } = params;
  const query = {};

  if (type === 'student') {
    query.studentId = new mongoose.Types.ObjectId(studentId);
  } else {
    query.lessonPlanId = new mongoose.Types.ObjectId(classId);
  }

  if (startDate || endDate) {
    query.assignedAt = {};
    if (startDate) query.assignedAt.$gte = new Date(startDate);
    if (endDate) query.assignedAt.$lte = new Date(endDate);
  }

  return query;
}

function calculateAverageGrade(taskList) {
  const gradedTasks = taskList.filter(
    (t) => t.grade && t.grade !== 'pending' && GRADE_MAP[t.grade] !== undefined,
  );

  if (gradedTasks.length === 0) return 'N/A';

  const sum = gradedTasks.reduce((acc, task) => acc + GRADE_MAP[task.grade], 0);
  const average = sum / gradedTasks.length;

  if (average >= GRADE_THRESHOLD_A) return 'A';
  if (average >= GRADE_THRESHOLD_B) return 'B';
  if (average >= GRADE_THRESHOLD_C) return 'C';
  if (average >= GRADE_THRESHOLD_D) return 'D';
  return 'F';
}

async function fetchStudentReport(studentId, startDate, endDate) {
  const query = buildTaskQuery('student', { studentId, startDate, endDate });

  const [tasks, student] = await Promise.all([
    EducationTask.find(query)
      .populate('studentId', 'firstName lastName email')
      .select(
        'type status grade dueAt completedAt feedback suggestedTotalHours loggedHours assignedAt',
      )
      .sort({ assignedAt: -1 })
      .limit(MAX_RECORDS_PER_REPORT)
      .lean(),
    UserProfile.findById(studentId).select('firstName lastName email').lean(),
  ]);

  if (!student) {
    throw new Error('Student not found');
  }

  if (!tasks || tasks.length === 0) {
    return null;
  }

  const taskData = tasks.map((task) => ({
    taskName: task.type || 'N/A',
    type: task.type,
    status: task.status,
    dueDate: task.dueAt,
    completedDate: task.completedAt,
    grade: task.grade || 'pending',
    feedback: task.feedback || '',
    suggestedHours: task.suggestedTotalHours || 0,
    loggedHours: task.loggedHours || 0,
    assignedAt: task.assignedAt,
  }));

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const graded = tasks.filter((t) => t.status === 'graded').length;
  const assigned = tasks.filter((t) => t.status === 'assigned').length;

  return {
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
    },
    tasks: taskData,
    summary: {
      totalTasks: tasks.length,
      completed,
      inProgress,
      graded,
      assigned,
      averageGrade: calculateAverageGrade(tasks),
    },
  };
}

async function fetchClassReport(classId, startDate, endDate) {
  const query = buildTaskQuery('class', { classId, startDate, endDate });

  const tasks = await EducationTask.find(query)
    .populate('studentId', 'firstName lastName email')
    .select('type status grade studentId assignedAt')
    .sort({ assignedAt: -1 })
    .limit(MAX_RECORDS_PER_REPORT)
    .lean();

  if (!tasks || tasks.length === 0) {
    return null;
  }

  const studentData = tasks.reduce((acc, task) => {
    if (!task.studentId) return acc;

    const studentIdStr = task.studentId._id.toString();

    if (!acc[studentIdStr]) {
      acc[studentIdStr] = {
        student: task.studentId,
        taskList: [],
        completed: 0,
        inProgress: 0,
        graded: 0,
        assigned: 0,
      };
    }

    acc[studentIdStr].taskList.push(task);

    if (task.status === 'completed') {
      acc[studentIdStr].completed += 1;
    } else if (task.status === 'in_progress') {
      acc[studentIdStr].inProgress += 1;
    } else if (task.status === 'graded') {
      acc[studentIdStr].graded += 1;
    } else if (task.status === 'assigned') {
      acc[studentIdStr].assigned += 1;
    }

    return acc;
  }, {});

  const students = Object.values(studentData).map(
    ({ student, taskList, completed, inProgress, graded, assigned }) => ({
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
      totalTasks: taskList.length,
      completed,
      inProgress,
      graded,
      assigned,
      averageGrade: calculateAverageGrade(taskList),
    }),
  );

  const totalCompleted = students.reduce((sum, s) => sum + s.completed, 0);
  const totalGrades = students.reduce((sum, s) => {
    const grade = parseFloat(s.averageGrade);
    return Number.isNaN(grade) ? sum : sum + grade;
  }, 0);

  const studentsWithGrades = students.filter((s) => s.averageGrade !== 'N/A').length;

  return {
    classId,
    students,
    summary: {
      totalStudents: students.length,
      totalTasks: tasks.length,
      averageCompletion:
        tasks.length > 0 ? ((totalCompleted / tasks.length) * 100).toFixed(2) : '0.00',
      classAverageGrade:
        studentsWithGrades > 0 ? (totalGrades / studentsWithGrades).toFixed(2) : 'N/A',
    },
  };
}

/* istanbul ignore next */
function generateStudentPDFContent(doc, reportData) {
  const { student, tasks, summary } = reportData;

  doc.fontSize(FONT_SIZE_SECTION_HEADER).font('Helvetica-Bold').text('Student Information');
  doc.fontSize(FONT_SIZE_BODY).font('Helvetica');
  doc.text(`Name: ${student.name}`);
  doc.text(`Email: ${student.email}`);
  doc.moveDown();

  doc.fontSize(FONT_SIZE_SUBSECTION).font('Helvetica-Bold').text('Performance Summary');
  doc.fontSize(FONT_SIZE_BODY).font('Helvetica');
  doc.text(`Total Tasks: ${summary.totalTasks}`);
  doc.text(`Completed: ${summary.completed}`);
  doc.text(`In Progress: ${summary.inProgress}`);
  doc.text(`Graded: ${summary.graded || 0}`);
  doc.text(`Assigned: ${summary.assigned || 0}`);
  doc.text(`Average Grade: ${summary.averageGrade}`);
  doc.moveDown();

  doc.fontSize(FONT_SIZE_SUBSECTION).font('Helvetica-Bold').text('Task Details');
  doc.moveDown(0.5);

  tasks.forEach((task, index) => {
    if (doc.y > PAGE_BREAK_THRESHOLD) {
      doc.addPage();
    }

    doc.fontSize(FONT_SIZE_BODY).font('Helvetica-Bold');
    doc.text(`${index + 1}. ${task.taskName} (${task.type})`);
    doc.fontSize(FONT_SIZE_DETAIL).font('Helvetica');
    doc.text(`   Status: ${task.status} | Grade: ${task.grade}`);
    doc.text(
      `   Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'} | Completed: ${task.completedDate ? new Date(task.completedDate).toLocaleDateString() : 'N/A'}`,
    );
    doc.text(`   Hours: ${task.loggedHours}/${task.suggestedHours}`);
    if (task.feedback) {
      doc.text(`   Feedback: ${task.feedback}`);
    }
    doc.moveDown(0.5);
  });
}

/* istanbul ignore next */
function generateClassPDFContent(doc, reportData) {
  const { students, summary } = reportData;

  doc.fontSize(FONT_SIZE_SUBSECTION).font('Helvetica-Bold').text('Class Summary');
  doc.fontSize(FONT_SIZE_BODY).font('Helvetica');
  doc.text(`Total Students: ${summary.totalStudents}`);
  doc.text(`Total Tasks: ${summary.totalTasks}`);
  doc.text(`Average Completion Rate: ${summary.averageCompletion}%`);
  doc.text(`Class Average Grade: ${summary.classAverageGrade}`);
  doc.moveDown();

  doc.fontSize(FONT_SIZE_SUBSECTION).font('Helvetica-Bold').text('Student Performance');
  doc.moveDown(0.5);

  students.forEach((student, index) => {
    if (doc.y > PAGE_BREAK_THRESHOLD) {
      doc.addPage();
    }

    doc.fontSize(FONT_SIZE_BODY).font('Helvetica-Bold');
    doc.text(`${index + 1}. ${student.name}`);
    doc.fontSize(FONT_SIZE_DETAIL).font('Helvetica');
    doc.text(`   Email: ${student.email}`);
    doc.text(
      `   Tasks: ${student.completed}/${student.totalTasks} completed | ${student.inProgress} in progress | ${student.graded} graded | ${student.assigned} assigned`,
    );
    doc.text(`   Average Grade: ${student.averageGrade}`);
    doc.moveDown(0.5);
  });
}

/* istanbul ignore next */
function generatePDFReport(res, reportData, metadata, type) {
  const doc = new PDFDocument({
    margin: 50,
    bufferPages: true,
    compress: true,
  });

  const filename = `${type}-report-${Date.now()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  doc.pipe(res);

  doc
    .fontSize(FONT_SIZE_TITLE)
    .font('Helvetica-Bold')
    .text('Performance Report', { align: 'center' });
  doc.moveDown();

  doc.fontSize(FONT_SIZE_METADATA).font('Helvetica');
  doc.fillColor('#666666');
  doc.text(`Generated: ${new Date(metadata.generatedDate).toLocaleString()}`);
  doc.text(`Generated By: ${metadata.generatedBy}`);
  doc.text(`Report Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`);

  if (metadata.filters.startDate !== 'N/A' || metadata.filters.endDate !== 'N/A') {
    doc.text(`Date Range: ${metadata.filters.startDate} to ${metadata.filters.endDate}`);
  }

  doc.moveDown();
  doc.fillColor('#000000');

  if (type === 'student') {
    generateStudentPDFContent(doc, reportData);
  } else {
    generateClassPDFContent(doc, reportData);
  }

  doc.end();
}

/* istanbul ignore next */
function generateCSVReport(res, reportData, metadata, type) {
  const filename = `${type}-report-${Date.now()}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  let fields;
  let data;

  if (type === 'student') {
    fields = [
      { label: 'Task Type', value: 'taskName' },
      { label: 'Status', value: 'status' },
      { label: 'Grade', value: 'grade' },
      { label: 'Due Date', value: 'dueDate' },
      { label: 'Completed Date', value: 'completedDate' },
      { label: 'Suggested Hours', value: 'suggestedHours' },
      { label: 'Logged Hours', value: 'loggedHours' },
      { label: 'Feedback', value: 'feedback' },
    ];

    data = reportData.tasks.map((task) => ({
      taskName: task.taskName,
      status: task.status,
      grade: task.grade,
      dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A',
      completedDate: task.completedDate ? new Date(task.completedDate).toLocaleDateString() : 'N/A',
      suggestedHours: task.suggestedHours,
      loggedHours: task.loggedHours,
      feedback: task.feedback || '',
    }));
  } else {
    fields = [
      { label: 'Student Name', value: 'name' },
      { label: 'Email', value: 'email' },
      { label: 'Total Tasks', value: 'totalTasks' },
      { label: 'Completed', value: 'completed' },
      { label: 'In Progress', value: 'inProgress' },
      { label: 'Graded', value: 'graded' },
      { label: 'Assigned', value: 'assigned' },
      { label: 'Average Grade', value: 'averageGrade' },
    ];

    data = reportData.students;
  }

  try {
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    // Add BOM for UTF-8 and send CSV in one response
    const csvWithBOM = `\ufeff${csv}`;
    res.send(csvWithBOM);
  } catch (error) {
    console.error('CSV generation error:', error);
    // Don't try to send another response if headers were already sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate CSV report' });
    }
  }
}

const downloadReportController = {
  exportReport: async (req, res) => {
    try {
      const { type, format, studentId, classId, startDate, endDate } = req.query;

      const validationErrors = validateReportRequest(req.query);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors,
        });
      }

      let reportData;
      try {
        if (type === 'student') {
          reportData = await fetchStudentReport(studentId, startDate, endDate);
        } else {
          reportData = await fetchClassReport(classId, startDate, endDate);
        }
      } catch (fetchError) {
        console.error('Error fetching report data:', fetchError);
        return res.status(400).json({
          error: fetchError.message,
        });
      }

      if (!reportData) {
        return res.status(404).json({
          error: 'No data found for the specified criteria',
        });
      }

      const metadata = {
        generatedDate: new Date().toISOString(),
        generatedBy: 'System Administrator',
        reportType: type,
        filters: {
          studentId: studentId || 'N/A',
          classId: classId || 'N/A',
          startDate: startDate || 'N/A',
          endDate: endDate || 'N/A',
        },
      };

      if (format === 'pdf') {
        generatePDFReport(res, reportData, metadata, type);
      } else {
        generateCSVReport(res, reportData, metadata, type);
      }
    } catch (error) {
      console.error('Error in exportReport controller:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: 'Failed to export report',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        });
      }
    }
    return undefined;
  },
};

module.exports = downloadReportController;
