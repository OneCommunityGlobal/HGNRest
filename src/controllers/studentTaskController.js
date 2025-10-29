const mongoose = require('mongoose');
const EducationTask = require('../models/educationTask');

const studentTaskController = function () {
  const groupTasks = (tasks) => {
    const grouped = {};

    tasks.forEach((task) => {
      // Add null checks to prevent undefined grouping
      const subjectKey = task.subject?.name || 'Unknown Subject';
      const colorKey = task.color_level || 'unknown';
      const activityKey = task.activity_group || 'Unassigned';

      if (!grouped[subjectKey]) {
        grouped[subjectKey] = {
          subject: task.subject,
          colorLevels: {},
        };
      }

      if (!grouped[subjectKey].colorLevels[colorKey]) {
        grouped[subjectKey].colorLevels[colorKey] = {
          color_level: colorKey,
          difficulty_level: task.difficulty_level,
          activityGroups: {},
        };
      }

      if (!grouped[subjectKey].colorLevels[colorKey].activityGroups[activityKey]) {
        grouped[subjectKey].colorLevels[colorKey].activityGroups[activityKey] = {
          activity_group: activityKey,
          tasks: [],
        };
      }

      grouped[subjectKey].colorLevels[colorKey].activityGroups[activityKey].tasks.push(task);
    });

    return grouped;
  };

  const calculateProgress = (tasks) => {
    const totalTasks = tasks.length;
    if (totalTasks === 0) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        progressPercent: 0,
        statusBreakdown: {},
      };
    }

    const statusCounts = {};
    let completedTasks = 0;

    tasks.forEach((task) => {
      const { status } = task;
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status === 'completed' || status === 'graded') {
        completedTasks += 1;
      }
    });

    return {
      totalTasks,
      completedTasks,
      progressPercent: Math.round((completedTasks / totalTasks) * 100),
      statusBreakdown: statusCounts,
    };
  };

  const getStudentTasks = async (req, res) => {
    try {
      const studentId = req.body.requestor.requestorId;

      if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
      }

      // Using EducationTask model with aggregation adapted for educationTask schema
      const studentTasks = await EducationTask.aggregate([
        {
          $match: {
            studentId: mongoose.Types.ObjectId(studentId),
          },
        },
        {
          $lookup: {
            from: 'lessonplans',
            localField: 'lessonPlanId',
            foreignField: '_id',
            as: 'lessonPlan',
          },
        },
        {
          $unwind: '$lessonPlan',
        },
        {
          $lookup: {
            from: 'atoms',
            localField: 'atomIds',
            foreignField: '_id',
            as: 'atoms',
          },
        },
        {
          $addFields: {
            // Get the first atom for grouping purposes (to avoid task duplication)
            firstAtom: { $arrayElemAt: ['$atoms', 0] },
            // Get all subjects from all atoms
            allSubjects: {
              $map: {
                input: '$atoms',
                as: 'atom',
                in: '$$atom.subjectId',
              },
            },
          },
        },
        {
          $lookup: {
            from: 'subjects',
            localField: 'firstAtom.subjectId',
            foreignField: '_id',
            as: 'subject',
          },
        },
        {
          $unwind: {
            path: '$subject',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            // Use first atom for difficulty grouping to avoid duplication
            color_level: {
              $cond: {
                if: { $ne: ['$firstAtom.difficulty', null] },
                then: '$firstAtom.difficulty',
                else: '$firstAtom.color_level',
              },
            },
            difficulty_level: {
              $cond: {
                if: { $ne: ['$firstAtom.difficulty', null] },
                then: '$firstAtom.difficulty',
                else: '$firstAtom.color_level',
              },
            },
            activity_group: { $ifNull: ['$lessonPlan.activityGroup', 'Unassigned'] },
          },
        },
        {
          $project: {
            _id: 1,
            studentId: 1,
            lessonPlanId: 1,
            atomIds: 1,
            type: 1,
            status: 1,
            assignedAt: 1,
            dueAt: 1,
            completedAt: 1,
            uploadUrls: 1,
            grade: 1,
            feedback: 1,
            suggestedTotalHours: 1,
            loggedHours: 1,
            lessonPlan: {
              _id: '$lessonPlan._id',
              title: '$lessonPlan.title',
              theme: '$lessonPlan.theme',
            },
            subject: {
              _id: '$subject._id',
              name: '$subject.name',
              description: '$subject.description',
              color: '$subject.color',
            },
            color_level: 1,
            difficulty_level: 1,
            atom: {
              _id: { $ifNull: ['$firstAtom._id', null] },
              name: { $ifNull: ['$firstAtom.name', 'Unknown Atom'] },
              difficulty: {
                $cond: {
                  if: { $ne: ['$firstAtom.difficulty', null] },
                  then: '$firstAtom.difficulty',
                  else: '$firstAtom.color_level',
                },
              },
            },
            activity_group: 1,
          },
        },
        {
          $sort: {
            dueAt: 1,
            'subject.name': 1,
            'atom.difficulty': 1,
          },
        },
      ]);

      const groupedTasks = groupTasks(studentTasks);
      const progressStats = calculateProgress(studentTasks);

      return res.status(200).json({
        tasks: groupedTasks,
        progress: progressStats,
        totalTasks: studentTasks.length,
      });
    } catch (error) {
      console.error('Error fetching student tasks:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message,
      });
    }
  };

  const updateTaskProgress = async (req, res) => {
    try {
      const { taskId } = req.params;
      const { progressPercent, status, loggedHours } = req.body;
      const studentId = req.body.requestor.requestorId;

      if (!taskId || (!progressPercent && !status && loggedHours === undefined)) {
        return res.status(400).json({ error: 'Task ID and progress data are required' });
      }

      const updateData = {};
      if (progressPercent !== undefined) {
        updateData.progressPercent = Math.min(100, Math.max(0, progressPercent));
      }
      if (status) {
        updateData.status = status;
      }
      if (loggedHours !== undefined) {
        updateData.loggedHours = Math.max(0, loggedHours);
      }

      const updatedTask = await EducationTask.findOneAndUpdate(
        {
          _id: mongoose.Types.ObjectId(taskId),
          studentId: mongoose.Types.ObjectId(studentId),
        },
        updateData,
        { new: true },
      )
        .populate('lessonPlanId', 'title theme')
        .populate('studentId', 'firstName lastName email')
        .populate('atomIds', 'name description difficulty');

      if (!updatedTask) {
        return res.status(404).json({ error: 'Student task not found' });
      }

      return res.status(200).json({
        message: 'Task progress updated successfully',
        task: updatedTask,
      });
    } catch (error) {
      console.error('Error updating task progress:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message,
      });
    }
  };

  const uploadFile = async (req, res) => {
    console.log('Uploading file');
    return res.status(200).json('File upload successfully');
  };
  const getFile = async (req, res) => {
    console.log('Get file');
    return res.status(200).json('Get File');
  };

  return {
    getStudentTasks,
    updateTaskProgress,
    uploadFile,
    getFile,
  };
};

module.exports = studentTaskController;
