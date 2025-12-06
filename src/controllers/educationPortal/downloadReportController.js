const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const stream = require('stream');
const EducationTask = require('../../models/educationTask');
const UserProfile = require('../../models/userProfile');

const REPORT_TYPES = ['student', 'class'];
const REPORT_FORMATS = ['pdf', 'csv'];
const MAX_RECORDS_PER_REPORT = 10000; // Prevent memory issues
const AUTHORIZED_ROLES = ['Administrator', 'Owner'];
const AUTHORIZED_PERMISSIONS = ['educator', 'projectManagement'];

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

  return errors;
}

function hasReportPermission(user) {
  return (
    AUTHORIZED_ROLES.includes(user.role) ||
    user.permissions?.frontPermissions?.some(perm => 
      AUTHORIZED_PERMISSIONS.includes(perm)
    )
  );
}

function buildTaskQuery(type, params) {
  const { studentId, classId, startDate, endDate } = params;
  const query = {};

  if (type === 'student') {
    query.assignedTo = studentId;
  } else {
    query.classId = classId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return query;
}

async function fetchStudentReport(studentId, startDate, endDate) {
  const query = buildTaskQuery('student', { studentId, startDate, endDate });

  const [tasks, student] = await Promise.all([
    EducationTask.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName')
      .select('taskName description status priority dueDate completedDate grade createdAt')
      .sort({ createdAt: -1 })
      .limit(MAX_RECORDS_PER_REPORT)
      .lean(),
    UserProfile.findById(studentId)
      .select('firstName lastName email')
      .lean()
  ]);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  if (!student) {
    throw new Error('Student not found');
  }

  const taskData = tasks.map(task => ({
    taskName: task.taskName,
    description: task.description || '',
    status: task.status,
    priority: task.priority || 'N/A',
    dueDate: task.dueDate,
    completedDate: task.completedDate,
    grade: task.grade || 'N/A',
    assignedBy: task.assignedBy 
      ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` 
      : 'N/A',
    createdAt: task.createdAt
  }));

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  const submitted = tasks.filter(t => t.status === 'submitted').length;

  return {
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email
    },
    tasks: taskData,
    summary: {
      totalTasks: tasks.length,
      completed,
      inProgress,
      submitted,
      averageGrade: calculateAverageGrade(tasks)
    }
  };
}

async function fetchClassReport(classId, startDate, endDate) {
  const query = buildTaskQuery('class', { classId, startDate, endDate });

  const tasks = await EducationTask.find(query)
    .populate('assignedTo', 'firstName lastName email')
    .populate('assignedBy', 'firstName lastName')
    .select('taskName status grade assignedTo createdAt')
    .sort({ createdAt: -1 })
    .limit(MAX_RECORDS_PER_REPORT)
    .lean();

  if (!tasks || tasks.length === 0) {
    return null;
  }

  const studentData = tasks.reduce((acc, task) => {
    if (!task.assignedTo) return acc;
    
    const studentId = task.assignedTo._id.toString();
    
    if (!acc[studentId]) {
      acc[studentId] = {
        student: task.assignedTo,
        tasks: [],
        completed: 0,
        inProgress: 0,
        submitted: 0
      };
    }
    
    acc[studentId].tasks.push(task);
    
    if (task.status === 'completed') acc[studentId].completed++;
    else if (task.status === 'in-progress') acc[studentId].inProgress++;
    else if (task.status === 'submitted') acc[studentId].submitted++;
    
    return acc;
  }, {});

  const students = Object.values(studentData).map(({ student, tasks, completed, inProgress, submitted }) => ({
    id: student._id,
    name: `${student.firstName} ${student.lastName}`,
    email: student.email,
    totalTasks: tasks.length,
    completed,
    inProgress,
    submitted,
    averageGrade: calculateAverageGrade(tasks)
  }));

  const totalCompleted = students.reduce((sum, s) => sum + s.completed, 0);
  const totalGrades = students.reduce((sum, s) => {
    const grade = parseFloat(s.averageGrade);
    return isNaN(grade) ? sum : sum + grade;
  }, 0);
  
  const studentsWithGrades = students.filter(s => s.averageGrade !== 'N/A').length;

  return {
    classId,
    students,
    summary: {
      totalStudents: students.length,
      totalTasks: tasks.length,
      averageCompletion: tasks.length > 0 
        ? ((totalCompleted / tasks.length) * 100).toFixed(2) 
        : '0.00',
      classAverageGrade: studentsWithGrades > 0
        ? (totalGrades / studentsWithGrades).toFixed(2)
        : 'N/A'
    }
  };
}

function calculateAverageGrade(tasks) {
  const gradedTasks = tasks.filter(t => t.grade && !isNaN(t.grade));
  
  if (gradedTasks.length === 0) return 'N/A';
  
  const sum = gradedTasks.reduce((acc, task) => acc + parseFloat(task.grade), 0);
  return (sum / gradedTasks.length).toFixed(2);
}

function generatePDFReport(res, reportData, metadata, type) {
  const doc = new PDFDocument({ 
    margin: 50,
    bufferPages: true,
    compress: true 
  });
  
  const filename = `${type}-report-${Date.now()}.pdf`;
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  doc.pipe(res);

  doc.fontSize(24).font('Helvetica-Bold').text('Performance Report', { align: 'center' });
  doc.moveDown();
  
  doc.fontSize(10).font('Helvetica');
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

function generateStudentPDFContent(doc, reportData) {
  const { student, tasks, summary } = reportData;

  doc.fontSize(16).font('Helvetica-Bold').text('Student Information');
  doc.fontSize(11).font('Helvetica');
  doc.text(`Name: ${student.name}`);
  doc.text(`Email: ${student.email}`);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Performance Summary');
  doc.fontSize(11).font('Helvetica');
  doc.text(`Total Tasks: ${summary.totalTasks}`);
  doc.text(`Completed: ${summary.completed}`);
  doc.text(`In Progress: ${summary.inProgress}`);
  doc.text(`Submitted: ${summary.submitted || 0}`);
  doc.text(`Average Grade: ${summary.averageGrade}`);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Task Details');
  doc.moveDown(0.5);
  
  tasks.forEach((task, index) => {
    if (doc.y > 700) {
      doc.addPage();
    }
    
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`${index + 1}. ${task.taskName}`);
    doc.fontSize(10).font('Helvetica');
    doc.text(`   Status: ${task.status} | Priority: ${task.priority} | Grade: ${task.grade}`);
    doc.text(`   Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'} | Completed: ${task.completedDate ? new Date(task.completedDate).toLocaleDateString() : 'N/A'}`);
    doc.text(`   Assigned By: ${task.assignedBy}`);
    doc.moveDown(0.5);
  });
}

function generateClassPDFContent(doc, reportData) {
  const { students, summary } = reportData;

  doc.fontSize(14).font('Helvetica-Bold').text('Class Summary');
  doc.fontSize(11).font('Helvetica');
  doc.text(`Total Students: ${summary.totalStudents}`);
  doc.text(`Total Tasks: ${summary.totalTasks}`);
  doc.text(`Average Completion Rate: ${summary.averageCompletion}%`);
  doc.text(`Class Average Grade: ${summary.classAverageGrade}`);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Student Performance');
  doc.moveDown(0.5);
  
  students.forEach((student, index) => {
    if (doc.y > 700) {
      doc.addPage();
    }
    
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`${index + 1}. ${student.name}`);
    doc.fontSize(10).font('Helvetica');
    doc.text(`   Email: ${student.email}`);
    doc.text(`   Completed: ${student.completed}/${student.totalTasks} | In Progress: ${student.inProgress} | Average Grade: ${student.averageGrade}`);
    doc.moveDown(0.5);
  });
}

function generateCSVReport(res, reportData, metadata, type) {
  const filename = `${type}-report-${Date.now()}.csv`;
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  let fields, data;

  if (type === 'student') {
    fields = [
      { label: 'Task Name', value: 'taskName' },
      { label: 'Description', value: 'description' },
      { label: 'Status', value: 'status' },
      { label: 'Priority', value: 'priority' },
      { label: 'Grade', value: 'grade' },
      { label: 'Due Date', value: 'dueDate' },
      { label: 'Completed Date', value: 'completedDate' },
      { label: 'Assigned By', value: 'assignedBy' }
    ];
    
    data = reportData.tasks.map(task => ({
      taskName: task.taskName,
      description: task.description,
      status: task.status,
      priority: task.priority,
      grade: task.grade,
      dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A',
      completedDate: task.completedDate ? new Date(task.completedDate).toLocaleDateString() : 'N/A',
      assignedBy: task.assignedBy
    }));
  } else {
    fields = [
      { label: 'Student Name', value: 'name' },
      { label: 'Email', value: 'email' },
      { label: 'Total Tasks', value: 'totalTasks' },
      { label: 'Completed', value: 'completed' },
      { label: 'In Progress', value: 'inProgress' },
      { label: 'Submitted', value: 'submitted' },
      { label: 'Average Grade', value: 'averageGrade' }
    ];
    
    data = reportData.students.map(student => ({
      name: student.name,
      email: student.email,
      totalTasks: student.totalTasks,
      completed: student.completed,
      inProgress: student.inProgress,
      submitted: student.submitted || 0,
      averageGrade: student.averageGrade
    }));
  }

  try {
    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    
    res.write('\ufeff');
    res.send(csv);
  } catch (error) {
    console.error('CSV generation error:', error);
    res.status(500).json({ error: 'Failed to generate CSV report' });
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
          details: validationErrors 
        });
      }

      const requestorId = req.body.requestor?._id;
      if (!requestorId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const requestor = await UserProfile.findById(requestorId)
        .select('firstName lastName role permissions')
        .lean();
      
      if (!requestor) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!hasReportPermission(requestor)) {
        return res.status(403).json({ 
          error: 'Access denied. Insufficient permissions to download reports.' 
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
          error: fetchError.message 
        });
      }

      if (!reportData) {
        return res.status(404).json({ 
          error: 'No data found for the specified criteria' 
        });
      }

      const metadata = {
        generatedDate: new Date().toISOString(),
        generatedBy: `${requestor.firstName} ${requestor.lastName}`,
        reportType: type,
        filters: {
          studentId: studentId || 'N/A',
          classId: classId || 'N/A',
          startDate: startDate || 'N/A',
          endDate: endDate || 'N/A'
        }
      };

      if (format === 'pdf') {
        generatePDFReport(res, reportData, metadata, type);
      } else {
        generateCSVReport(res, reportData, metadata, type);
      }

    } catch (error) {
      console.error('Error in exportReport controller:', error);
      return res.status(500).json({ 
        error: 'Failed to export report',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = downloadReportController;