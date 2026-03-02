const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
// const Task = require('../../models/task');

const bmTimeLoggerController = function (bmTimeLog) {
  // Start Time Log
  const startTimeLog = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const { task } = req.body;

      const now = new Date();

      // Convert to ObjectId for proper MongoDB query
      const projectObjectId = mongoose.Types.ObjectId.isValid(projectId)
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;
      const memberObjectId = mongoose.Types.ObjectId.isValid(memberId)
        ? new mongoose.Types.ObjectId(memberId)
        : memberId;

      // Check if there's already an ongoing time log for this project and member
      const existingTimeLog = await bmTimeLog.findOne({
        project: projectObjectId,
        member: memberObjectId,
        status: { $in: ['ongoing', 'paused'] },
      });

      let timeLog;

      if (existingTimeLog) {
        // If existing time log is paused, resume it
        if (existingTimeLog.status === 'paused') {
          // Ensure intervals is an array before updating
          if (existingTimeLog.intervals === null) {
            existingTimeLog.intervals = [];
          }

          timeLog = await bmTimeLog.findByIdAndUpdate(
            existingTimeLog._id,
            {
              $set: {
                status: 'ongoing',
                currentIntervalStarted: now,
              },
            },
            { new: true, runValidators: true },
          );
        } else {
          // If already ongoing, just return it
          timeLog = existingTimeLog;
        }
      } else {
        // Create a new time log
        timeLog = await bmTimeLog.create({
          project: projectObjectId,
          member: memberObjectId,
          task: task || 'Default Task',
          status: 'ongoing',
          currentIntervalStarted: now,
          totalElapsedTime: 0,
          intervals: [],
        });
      }

      res.status(200).json({
        message: 'Time log started successfully',
        timeLog,
      });
    } catch (error) {
      res.status(500).json({
        message: 'Error starting time log',
        error: error.message,
      });
    }
  };

  // Pause Time Log
  const pauseTimeLog = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const { timeLogId } = req.body;

      // fetch the current document to ensure we have valid data fisrt
      const currentTimeLog = await bmTimeLog.findOne({
        _id: timeLogId,
        project: projectId,
        member: memberId,
        status: 'ongoing',
      });

      if (!currentTimeLog) {
        return res.status(404).json({ message: 'Active time log not found' });
      }

      const currentDuration =
        Date.now() - (currentTimeLog.currentIntervalStarted?.getTime() || Date.now());

      const newTotalElapsedTime = (currentTimeLog.totalElapsedTime || 0) + currentDuration;

      // Create the new interval
      const newInterval = {
        startTime: currentTimeLog.currentIntervalStarted || new Date(),
        endTime: new Date(),
        duration: currentDuration,
      };

      const updatedTimeLog = await bmTimeLog.findByIdAndUpdate(
        timeLogId,
        {
          $push: { intervals: newInterval },
          $set: {
            totalElapsedTime: newTotalElapsedTime,
            status: 'paused',
            currentIntervalStarted: null,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

      res.status(200).json({
        message: 'Time log paused successfully',
        timeLog: updatedTimeLog,
      });
    } catch (error) {
      res.status(500).json({
        message: 'Error pausing time log',
        error: error.message,
      });
    }
  };

  // Stop Time Log
  const stopTimeLog = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const { timeLogId } = req.body;

      const updatedTimeLog = await bmTimeLog.findOneAndUpdate(
        {
          _id: timeLogId,
          project: projectId,
          member: memberId,
          $or: [{ status: 'ongoing' }, { status: 'paused' }],
        },
        [
          {
            $set: {
              status: 'completed',
              currentIntervalStarted: null,
              totalElapsedTime: {
                $add: [
                  '$totalElapsedTime',
                  {
                    $cond: {
                      if: { $and: [{ $eq: ['$status', 'ongoing'] }, '$currentIntervalStarted'] },
                      then: { $subtract: [new Date(), '$currentIntervalStarted'] },
                      else: 0,
                    },
                  },
                ],
              },
            },
          },
          {
            $set: {
              intervals: {
                $cond: {
                  if: { $and: [{ $eq: ['$status', 'ongoing'] }, '$currentIntervalStarted'] },
                  then: {
                    $concatArrays: [
                      '$intervals',
                      [
                        {
                          startTime: '$currentIntervalStarted',
                          endTime: new Date(),
                          duration: { $subtract: [new Date(), '$currentIntervalStarted'] },
                        },
                      ],
                    ],
                  },
                  else: '$intervals',
                },
              },
            },
          },
        ],
        {
          new: true, // Return updated document
          runValidators: true,
        },
      );

      if (!updatedTimeLog) {
        return res.status(404).json({ message: 'Active time log not found' });
      }

      // increment project member's hours
      const updatedProject = await BuildingProject.findOneAndUpdate(
        {
          _id: projectId,
          'members.user': memberId,
        },
        {
          $inc: {
            'members.$.hours': updatedTimeLog.totalElapsedTime / (1000 * 60 * 60),
          },
        },
        {
          new: true,
        },
      );

      res.status(200).json({
        message: 'Time log stopped successfully',
        timeLog: updatedTimeLog,
        project: updatedProject,
      });
    } catch (error) {
      res.status(500).json({
        message: 'Error stopping time log',
        error: error.message,
      });
    }
  };

  const getProjectTimeLogs = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;

      // Convert projectId to ObjectId for proper MongoDB query
      const projectObjectId = mongoose.Types.ObjectId.isValid(projectId)
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;

      const matchStage = { project: projectObjectId };
      // Only filter by member if memberId is provided and it's not undefined
      if (memberId && memberId !== 'logs' && mongoose.Types.ObjectId.isValid(memberId)) {
        matchStage.member = new mongoose.Types.ObjectId(memberId);
      }

      const timeLogs = await bmTimeLog.aggregate([
        { $match: matchStage },
        // Convert member to ObjectId safely (handles both string and ObjectId)
        {
          $addFields: {
            memberObjectId: {
              $cond: {
                if: { $eq: [{ $type: '$member' }, 'string'] },
                then: {
                  $convert: {
                    input: '$member',
                    to: 'objectId',
                    onError: null,
                    onNull: null,
                  },
                },
                else: '$member',
              },
            },
          },
        },
        {
          $lookup: {
            from: 'userProfiles',
            localField: 'memberObjectId',
            foreignField: '_id',
            as: 'member',
          },
        },
        { $unwind: { path: '$member', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            project: 1,
            member: {
              _id: { $ifNull: ['$member._id', null] },
              firstName: { $ifNull: ['$member.firstName', 'Unknown'] },
              lastName: { $ifNull: ['$member.lastName', 'User'] },
              role: { $ifNull: ['$member.role', 'N/A'] },
            },
            intervals: 1,
            status: 1,
            totalElapsedTime: 1,
            createdAt: 1,
            updatedAt: 1,
            task: 1,
          },
        },
        { $sort: { createdAt: -1 } },
      ]);

      res.status(200).json(timeLogs);
    } catch (error) {
      res.status(500).json({
        message: 'Error fetching time logs',
        error: error.message,
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
