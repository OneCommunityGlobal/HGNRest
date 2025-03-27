const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const Task = require('../../models/task');

const bmTimeLoggerController = function (bmTimeLog) {
  // Start or Resume Time Log
  const startTimeLog = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const { task } = req.body;

      // Validate project exists
      const project = await BuildingProject.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Find or create ongoing time log
      let timeLog = await bmTimeLog.findOne({
        project: projectId,
        member: memberId,
        $or: [
          { status: 'ongoing' },
          { status: 'paused' }
        ]
      });

      // If no existing log, create a new one
      if (!timeLog) {
        timeLog = new bmTimeLog({
          project: projectId,
          member: memberId,
          task: task,
          intervals: [],
          status: 'ongoing',
          currentIntervalStarted: new Date()
        });
      } else {
        // If paused, start a new interval
        if (timeLog.status === 'paused') {
          timeLog.status = 'ongoing';
          timeLog.currentIntervalStarted = new Date();
        }
      }

      await timeLog.save();

      res.status(201).json({
        message: 'Time log started/resumed successfully',
        timeLog: timeLog
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error starting time log', 
        error: error.message 
      });
    }
  };

  // Pause Time Log
  const pauseTimeLog = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const { timeLogId } = req.body;

      const timeLog = await bmTimeLog.findOne({
        _id: timeLogId,
        project: projectId,
        member: memberId,
        status: 'ongoing'
      });

      if (!timeLog) {
        return res.status(404).json({ message: 'Active time log not found' });
      }

      // Calculate and store the interval duration
      const currentInterval = {
        startTime: timeLog.currentIntervalStarted,
        endTime: new Date(),
        duration: Date.now() - timeLog.currentIntervalStarted.getTime()
      };

      // Update time log
      timeLog.intervals.push(currentInterval);
      timeLog.totalElapsedTime = timeLog.calculateTotalElapsedTime();
      timeLog.status = 'paused';
      timeLog.currentIntervalStarted = null;

      await timeLog.save();

      res.status(200).json({
        message: 'Time log paused successfully',
        timeLog: timeLog
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error pausing time log', 
        error: error.message 
      });
    }
  };

  // Stop Time Log
  const stopTimeLog = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const { timeLogId } = req.body;

      const timeLog = await bmTimeLog.findOne({
        _id: timeLogId,
        project: projectId,
        member: memberId,
        $or: [{ status: 'ongoing' }, { status: 'paused' }]
      });

      if (!timeLog) {
        return res.status(404).json({ message: 'Active time log not found' });
      }

      // If currently running, pause the current interval
      if (timeLog.status === 'ongoing' && timeLog.currentIntervalStarted) {
        const currentInterval = {
          startTime: timeLog.currentIntervalStarted,
          endTime: new Date(),
          duration: Date.now() - timeLog.currentIntervalStarted.getTime()
        };
        timeLog.intervals.push(currentInterval);
      }

      // Calculate total elapsed time
      timeLog.totalElapsedTime = timeLog.calculateTotalElapsedTime();
      timeLog.status = 'completed';
      timeLog.currentIntervalStarted = null;

      await timeLog.save();

      // Update project member hours
      const project = await BuildingProject.findById(projectId);
      const memberIndex = project.members.findIndex(
        m => m.user.toString() === memberId
      );

      if (memberIndex !== -1) {
        // Add total elapsed time to existing hours (converting milliseconds to hours)
        project.members[memberIndex].hours += timeLog.totalElapsedTime / (1000 * 60 * 60);
        await project.save();
      }

      res.status(200).json({
        message: 'Time log stopped successfully',
        timeLog: timeLog
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error stopping time log', 
        error: error.message 
      });
    }
  };
  
  const getProjectTimeLogs = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;

      const query = { project: projectId };
      if (memberId) {
        query.member = memberId;
      }

      const timeLogs = await TimeLog.find(query)
        .populate('member', 'firstName lastName')
        .sort({ createdAt: -1 });

      res.status(200).json(timeLogs);
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching time logs', 
        error: error.message 
      });
    }
  };

  return {
    startTimeLog,
    pauseTimeLog,
    stopTimeLog,
    getProjectTimeLogs,
  };
};

module.exports = bmTimeLoggerController;