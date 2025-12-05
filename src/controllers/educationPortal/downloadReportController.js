const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const EducationTask = require('../../models/educationTask');
const UserProfile = require('../../models/userProfile');

const downloadReportController = {
  /**
   * Export student or class performance reports
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  exportReport: async (req, res) => {
    try {
      const { type, format } = req.query;
      const requestorId = req.body.requestor._id;
      const { studentId, classId, startDate, endDate } = req.query;

      // Validate parameters
      if (!type || !['student', 'class'].includes(type)) {
        return res.status(400).json({ 
          error: 'Invalid or missing type parameter. Must be "student" or "class"' 
        });
      }

      if (!format || !['pdf', 'csv'].includes(format)) {
        return res.status(400).json({ 
          error: 'Invalid or missing format parameter. Must be "pdf" or "csv"' 
        });
      }

      // Get requestor details
      const requestor = await UserProfile.findById(requestorId).select('firstName lastName role permissions');
      
      if (!requestor) {
        return res.status(404).json({ error: 'Requestor not found' });
      }

      // Verify permissions (educator, project manager, or admin)
      const hasPermission = requestor.role === 'Administrator' || 
                           requestor.role === 'Owner' ||
                           requestor.permissions?.frontPermissions?.includes('educator') ||
                           requestor.permissions?.frontPermissions?.includes('projectManagement');

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Access denied. Only educators and project managers can download reports.' 
        });
      }

      // Fetch report data based on type
      let reportData;
      if (type === 'student') {
        reportData = await fetchStudentReport(studentId, startDate, endDate);
      } else {
        reportData = await fetchClassReport(classId, startDate, endDate);
      }

      if (!reportData) {
        return res.status(404).json({ error: 'No data found for the specified criteria' });
      }

      // Add metadata
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

      // Generate export based on format
      if (format === 'pdf') {
        return generatePDFReport(res, reportData, metadata, type);
      } else {
        return generateCSVReport(res, reportData, metadata, type);
      }

    } catch (error) {
      console.error('Error exporting report:', error);
      return res.status(500).json({ 
        error: 'Failed to export report',
        message: error.message 
      });
    }
  }
};

/**
 * Fetch student performance report data
 */
async function fetchStudentReport(studentId, startDate, endDate) {
  if (!studentId) {
    throw new Error('Student ID is required for student reports');
  }

  const query = {
    assignedTo: studentId,
    status: { $in: ['completed', 'in-progress', 'submitted'] }
  };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const tasks = await EducationTask.find(query)
    .populate('assignedTo', 'firstName lastName email')
    .populate('assignedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  if (!tasks || tasks.length === 0) return null;

  const student = await UserProfile.findById(studentId).select('firstName lastName email');

  return {
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email
    },
    tasks: tasks.map(task => ({
      taskName: task.taskName,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      completedDate: task.completedDate,
      grade: task.grade || 'N/A',
      assignedBy: task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : 'N/A',
      createdAt: task.createdAt
    })),
    summary: {
      totalTasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      averageGrade: calculateAverageGrade(tasks)
    }
  };
}

/**
 * Fetch class performance report data
 */
async function fetchClassReport(classId, startDate, endDate) {
  if (!classId) {
    throw new Error('Class ID is required for class reports');
  }

  const query = {
    classId: classId
  };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const tasks = await EducationTask.find(query)
    .populate('assignedTo', 'firstName lastName email')
    .populate('assignedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  if (!tasks || tasks.length === 0) return null;

  // Group by students
  const studentMap = new Map();
  tasks.forEach(task => {
    if (!task.assignedTo) return;
    
    const studentId = task.assignedTo._id.toString();
    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        student: task.assignedTo,
        tasks: []
      });
    }
    studentMap.get(studentId).tasks.push(task);
  });

  const students = Array.from(studentMap.values()).map(({ student, tasks }) => ({
    id: student._id,
    name: `${student.firstName} ${student.lastName}`,
    email: student.email,
    totalTasks: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    averageGrade: calculateAverageGrade(tasks)
  }));

  return {
    classId: classId,
    students: students,
    summary: {
      totalStudents: students.length,
      totalTasks: tasks.length,
      averageCompletion: (students.reduce((sum, s) => sum + s.completed, 0) / tasks.length * 100).toFixed(2),
      classAverageGrade: (students.reduce((sum, s) => sum + parseFloat(s.averageGrade), 0) / students.length).toFixed(2)
    }
  };
}

/**
 * Calculate average grade from tasks
 */
function calculateAverageGrade(tasks) {
  const gradedTasks = tasks.filter(t => t.grade && !isNaN(t.grade));
  if (gradedTasks.length === 0) return 'N/A';
  
  const sum = gradedTasks.reduce((acc, task) => acc + parseFloat(task.grade), 0);
  return (sum / gradedTasks.length).toFixed(2);
}

/**
 * Generate PDF report
 */
function generatePDFReport(res, reportData, metadata, type) {
  const doc = new PDFDocument({ margin: 50 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.pdf`);
  
  doc.pipe(res);

  // Header
  doc.fontSize(20).text('Performance Report', { align: 'center' });
  doc.moveDown();
  
  // Metadata
  doc.fontSize(10);
  doc.text(`Generated: ${new Date(metadata.generatedDate).toLocaleString()}`);
  doc.text(`Generated By: ${metadata.generatedBy}`);
  doc.text(`Report Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`);
  doc.moveDown();

  if (type === 'student') {
    // Student Report
    doc.fontSize(14).text(`Student: ${reportData.student.name}`);
    doc.fontSize(10).text(`Email: ${reportData.student.email}`);
    doc.moveDown();

    doc.fontSize(12).text('Summary:');
    doc.fontSize(10);
    doc.text(`Total Tasks: ${reportData.summary.totalTasks}`);
    doc.text(`Completed: ${reportData.summary.completed}`);
    doc.text(`In Progress: ${reportData.summary.inProgress}`);
    doc.text(`Average Grade: ${reportData.summary.averageGrade}`);
    doc.moveDown();

    doc.fontSize(12).text('Task Details:');
    reportData.tasks.forEach((task, index) => {
      doc.fontSize(10);
      doc.text(`${index + 1}. ${task.taskName}`);
      doc.text(`   Status: ${task.status} | Grade: ${task.grade} | Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}`);
    });
  } else {
    // Class Report
    doc.fontSize(14).text(`Class Report`);
    doc.moveDown();

    doc.fontSize(12).text('Summary:');
    doc.fontSize(10);
    doc.text(`Total Students: ${reportData.summary.totalStudents}`);
    doc.text(`Total Tasks: ${reportData.summary.totalTasks}`);
    doc.text(`Average Completion: ${reportData.summary.averageCompletion}%`);
    doc.text(`Class Average Grade: ${reportData.summary.classAverageGrade}`);
    doc.moveDown();

    doc.fontSize(12).text('Student Performance:');
    reportData.students.forEach((student, index) => {
      doc.fontSize(10);
      doc.text(`${index + 1}. ${student.name}`);
      doc.text(`   Completed: ${student.completed}/${student.totalTasks} | Avg Grade: ${student.averageGrade}`);
    });
  }

  doc.end();
}

/**
 * Generate CSV report
 */
function generateCSVReport(res, reportData, metadata, type) {
  let fields, data;

  if (type === 'student') {
    fields = [
      'Task Name',
      'Description',
      'Status',
      'Priority',
      'Grade',
      'Due Date',
      'Completed Date',
      'Assigned By'
    ];
    
    data = reportData.tasks.map(task => ({
      'Task Name': task.taskName,
      'Description': task.description,
      'Status': task.status,
      'Priority': task.priority,
      'Grade': task.grade,
      'Due Date': task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A',
      'Completed Date': task.completedDate ? new Date(task.completedDate).toLocaleDateString() : 'N/A',
      'Assigned By': task.assignedBy
    }));
  } else {
    fields = [
      'Student Name',
      'Email',
      'Total Tasks',
      'Completed',
      'In Progress',
      'Average Grade'
    ];
    
    data = reportData.students.map(student => ({
      'Student Name': student.name,
      'Email': student.email,
      'Total Tasks': student.totalTasks,
      'Completed': student.completed,
      'In Progress': student.inProgress,
      'Average Grade': student.averageGrade
    }));
  }

  const parser = new Parser({ fields });
  const csv = parser.parse(data);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.csv`);
  res.send(csv);
}

module.exports = downloadReportController;