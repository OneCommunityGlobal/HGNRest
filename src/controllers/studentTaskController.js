const mongoose = require('mongoose');
const StudentTask = require('../models/studentTask');

const studentTaskController = function () {
  const groupTasks = (tasks) => {
    const grouped = {};

    tasks.forEach(task => {
      const subjectKey = task.subject.name;
      const colorKey = task.color_level;
      const activityKey = task.activity_group || 'Unassigned';

      if (!grouped[subjectKey]) {
        grouped[subjectKey] = {
          subject: task.subject,
          colorLevels: {}
        };
      }

      if (!grouped[subjectKey].colorLevels[colorKey]) {
        grouped[subjectKey].colorLevels[colorKey] = {
          color_level: colorKey,
          difficulty_level: task.difficulty_level,
          activityGroups: {}
        };
      }

      if (!grouped[subjectKey].colorLevels[colorKey].activityGroups[activityKey]) {
        grouped[subjectKey].colorLevels[colorKey].activityGroups[activityKey] = {
          activity_group: activityKey,
          tasks: []
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
        statusBreakdown: {}
      };
    }

    const statusCounts = {};
    let completedTasks = 0;

    tasks.forEach(task => {
      const { status } = task;
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status === 'completed' || status === 'submitted' || status === 'reviewed') {
        completedTasks += 1;
      }
    });

    return {
      totalTasks,
      completedTasks,
      progressPercent: Math.round((completedTasks / totalTasks) * 100),
      statusBreakdown: statusCounts
    };
  };

  const getStudentTasks = async (req, res) => {
    try {
      const studentId = req.body.requestor.requestorId;

      if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
      }


      const studentTasks = await StudentTask.aggregate([
        {
          $match: {
            student_id: mongoose.Types.ObjectId(studentId)
          }
        },
        {
          $lookup: {
            from: 'tasks',
            localField: 'task_id',
            foreignField: '_id',
            as: 'task'
          }
        },
        {
          $unwind: '$task'
        },
        {
          $lookup: {
            from: 'subjects',
            localField: 'subject_id',
            foreignField: '_id',
            as: 'subject'
          }
        },
        {
          $unwind: '$subject'
        },
        {
          $lookup: {
            from: 'atoms',
            localField: 'atom_id',
            foreignField: '_id',
            as: 'atom'
          }
        },
        {
          $unwind: '$atom'
        },
        {
          $lookup: {
            from: 'strategies',
            localField: 'activity_group_id',
            foreignField: '_id',
            as: 'activityGroup'
          }
        },
        {
          $lookup: {
            from: 'strategies',
            localField: 'teaching_strategy_id',
            foreignField: '_id',
            as: 'teachingStrategy'
          }
        },
        {
          $lookup: {
            from: 'strategies',
            localField: 'life_strategy_id',
            foreignField: '_id',
            as: 'lifeStrategy'
          }
        },
        {
          $lookup: {
            from: 'taskRubrics',
            localField: 'task_id',
            foreignField: 'task_id',
            as: 'rubric'
          }
        },
        {
          $addFields: {
            activityGroup: { $arrayElemAt: ['$activityGroup', 0] },
            teachingStrategy: { $arrayElemAt: ['$teachingStrategy', 0] },
            lifeStrategy: { $arrayElemAt: ['$lifeStrategy', 0] },
            rubric: { $arrayElemAt: ['$rubric', 0] }
          }
        },
        {
          $project: {
            _id: 1,
            student_id: 1,
            task_id: 1,
            status: 1,
            due_date: 1,
            progress_percent: 1,
            assigned_at: 1,
            started_at: 1,
            completed_at: 1,
            submitted_at: 1,
            reviewed_at: 1,
            grade: 1,
            feedback: 1,
            task: {
              _id: '$task._id',
              taskName: '$task.taskName',
              priority: '$task.priority',
              estimatedHours: '$task.estimatedHours',
              whyInfo: '$task.whyInfo',
              intentInfo: '$task.intentInfo',
              endStateInfo: '$task.endstateInfo'
            },
            subject: {
              _id: '$subject._id',
              name: '$subject.name',
              description: '$subject.description',
              color: '$subject.color'
            },
            color_level: '$atom.color_level',
            difficulty_level: '$atom.difficulty_level',
            atom: {
              _id: '$atom._id',
              name: '$atom.name',
              color_level: '$atom.color_level',
              difficulty_level: '$atom.difficulty_level'
            },
            activity_group: '$activityGroup.name',
            teaching_strategy: '$teachingStrategy.name',
            life_strategy: '$lifeStrategy.name',
            grading_rubric: '$rubric.rubric_json'
          }
        },
        {
          $sort: {
            due_date: 1,
            'subject.name': 1,
            'atom.color_level': 1
          }
        }
      ]);

      const groupedTasks = groupTasks(studentTasks);
      const progressStats = calculateProgress(studentTasks);

      return res.status(200).json({
        tasks: groupedTasks,
        progress: progressStats,
        totalTasks: studentTasks.length
      });

    } catch (error) {
      console.error('Error fetching student tasks:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  };

  const updateTaskProgress = async (req, res) => {
    try {
      const { taskId } = req.params;
      const { progressPercent, status } = req.body;
      const studentId = req.body.requestor.requestorId;

      if (!taskId || (!progressPercent && !status)) {
        return res.status(400).json({ error: 'Task ID and progress data are required' });
      }

      const updateData = {};
      if (progressPercent !== undefined) {
        updateData.progress_percent = Math.min(100, Math.max(0, progressPercent));
      }
      if (status) {
        updateData.status = status;
      }

      const updatedTask = await StudentTask.findOneAndUpdate(
        {
          task_id: mongoose.Types.ObjectId(taskId),
          student_id: mongoose.Types.ObjectId(studentId)
        },
        updateData,
        { new: true }
      );

      if (!updatedTask) {
        return res.status(404).json({ error: 'Student task not found' });
      }

      return res.status(200).json({
        message: 'Task progress updated successfully',
        task: updatedTask
      });

    } catch (error) {
      console.error('Error updating task progress:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  };

  return {
    getStudentTasks,
    updateTaskProgress
  };
};

module.exports = studentTaskController;