const moment = require('moment');
const mongoose = require('mongoose');
const InjurySeverity = require('../models/Injury');
const Project = require('../models/project');

// Severity mapping for transition
const severityMapping = {
  Minor: 'Low',
  Major: 'Serious',
  Medium: 'Medium',
  Low: 'Low',
  Serious: 'Serious',
};

const getInjuries = async (req, res) => {
  try {
    const { projectId, startDate, endDate } = req.query;

    const query = {};

    // Build query based on filters
    if (projectId && projectId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID format' });
      }
      query.projectId = new mongoose.Types.ObjectId(projectId);
    }

    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const startDateTime = moment(startDate).startOf('day').toDate();
        query.date.$gte = startDateTime;
      }

      if (endDate) {
        const endDateTime = moment(endDate).endOf('day').toDate();
        query.date.$lte = endDateTime;
      }
    }

    const injuries = await InjurySeverity.find(query).sort({ date: 1 });

    // If no injuries found, return empty data structure
    if (!injuries || injuries.length === 0) {
      return res.status(200).json({
        months: [],
        serious: [],
        medium: [],
        low: [],
      });
    }

    // Group data by month and severity
    const groupedData = {
      months: [],
      serious: [],
      medium: [],
      low: [],
    };

    const monthsSet = new Set();
    injuries.forEach((injury) => {
      const month = moment(injury.date).format('MMM'); // Only month without year
      monthsSet.add(month);
    });

    const months = Array.from(monthsSet);
    // Sort months in chronological order
    const monthOrder = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const sortedMonths = months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
    groupedData.months = sortedMonths;

    sortedMonths.forEach((month) => {
      // Handle both old and new severity levels
      const seriousCount = injuries
        .filter((injury) => {
          const mappedSeverity = severityMapping[injury.severity] || injury.severity;
          return moment(injury.date).format('MMM') === month && mappedSeverity === 'Serious';
        })
        .reduce((sum, injury) => sum + (injury.count || 0), 0);

      const mediumCount = injuries
        .filter((injury) => {
          const mappedSeverity = severityMapping[injury.severity] || injury.severity;
          return moment(injury.date).format('MMM') === month && mappedSeverity === 'Medium';
        })
        .reduce((sum, injury) => sum + (injury.count || 0), 0);

      const lowCount = injuries
        .filter((injury) => {
          const mappedSeverity = severityMapping[injury.severity] || injury.severity;
          return moment(injury.date).format('MMM') === month && mappedSeverity === 'Low';
        })
        .reduce((sum, injury) => sum + (injury.count || 0), 0);

      groupedData.serious.push(seriousCount);
      groupedData.medium.push(mediumCount);
      groupedData.low.push(lowCount);
    });

    res.status(200).json(groupedData);
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
    });
  }
};

const getProjects = async (req, res) => {
  try {
    const projects = await Project.find().sort({ projectName: 1 });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};

// Add new injury record
const createInjury = async (req, res) => {
  try {
    const { projectId, projectName, count, date, injuryType, department, severity } = req.body;

    // Validate required fields
    if (!projectId || !projectName || !count || !date || !injuryType || !department || !severity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate severity
    if (!['Serious', 'Medium', 'Low'].includes(severity)) {
      return res.status(400).json({ message: 'Invalid severity level' });
    }

    const injury = new InjurySeverity({
      projectId,
      projectName,
      count,
      date,
      injuryType,
      department,
      severity,
    });

    await injury.save();
    res.status(201).json(injury);
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};

// Update injury record
const updateInjury = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;

    // Validate severity if it's being updated
    if (update.severity && !['Serious', 'Medium', 'Low'].includes(update.severity)) {
      return res.status(400).json({ message: 'Invalid severity level' });
    }

    const injury = await InjurySeverity.findByIdAndUpdate(id, update, { new: true });
    if (!injury) {
      return res.status(404).json({ message: 'Injury record not found' });
    }

    res.status(200).json(injury);
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};

// Delete injury record
const deleteInjury = async (req, res) => {
  try {
    const { id } = req.params;
    const injury = await InjurySeverity.findByIdAndDelete(id);

    if (!injury) {
      return res.status(404).json({ message: 'Injury record not found' });
    }

    res.status(200).json({ message: 'Injury record deleted successfully' });
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  getInjuries,
  getProjects,
  createInjury,
  updateInjury,
  deleteInjury,
};
