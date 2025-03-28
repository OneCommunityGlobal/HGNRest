const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const Task = require('../../models/task');

const bmTimeLoggerController = function (bmTimeLog) {
  // Start or Resume Time Log
  const startTimeLog = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const { task } = req.body;

      const updatedTimeLog = await bmTimeLog.findOneAndUpdate(
        {
          project: projectId,
          member: memberId,
          $or: [{ status: "ongoing" }, { status: "paused" }]
        },
        [
          {
            $set: {
              status: "ongoing",
              task: task,
              currentIntervalStarted: {
                $cond: {
                  if: {
                    $or: [
                      { $eq: ["$status", "paused"] },
                      { $eq: ["$currentIntervalStarted", null] } // new timelog
                    ]
                  },
                  then: new Date(),
                  else: "$currentIntervalStarted"
                }
              }
            }
          }
        ],
        {
          new: true, // Return updated document
          upsert: true, // Create new if it doesn’t exist
          setDefaultsOnInsert: true, // Apply schema defaults
          runValidators: true
        }
      );

      res.status(201).json({
        message: "Time log started/resumed successfully",
        timeLog: updatedTimeLog
      });
    } catch (error) {
      res.status(500).json({
        message: "Error starting time log",
        error: error.message
      });
    }
  };


  // Pause Time Log
  const pauseTimeLog = async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const { timeLogId } = req.body;

      const updatedTimeLog = await bmTimeLog.findOneAndUpdate(
        { 
          _id: timeLogId, 
          project: projectId, 
          member: memberId, 
          status: 'ongoing' 
        },
        [
          {
            $set: {
              intervals: {
                $concatArrays: [
                  "$intervals",
                  [{
                    startTime: "$currentIntervalStarted",
                    endTime: new Date(),
                    duration: { 
                      $subtract: [new Date(), "$currentIntervalStarted"]
                    }
                  }]
                ]
              },
              totalElapsedTime: {
                $add: [
                  "$totalElapsedTime",
                  { $subtract: [new Date(), "$currentIntervalStarted"] }
                ]
              },
              status: "paused",
              currentIntervalStarted: null
            }
          }
        ],
        { 
          new: true, // Return updated document
          runValidators: true 
        }
      );

      if (!updatedTimeLog) {
        return res.status(404).json({ message: "Active time log not found" });
      }

      res.status(200).json({
        message: "Time log paused successfully",
        timeLog: updatedTimeLog
      });
    } catch (error) {
      res.status(500).json({
        message: "Error pausing time log",
        error: error.message
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
          $or: [{ status: "ongoing" }, { status: "paused" }]
        },
        [
          {
            $set: {
              status: "completed",
              currentIntervalStarted: null,
              totalElapsedTime: {
                $add: [
                  "$totalElapsedTime",
                  {
                    $cond: {
                      if: { $and: [{ $eq: ["$status", "ongoing"] }, "$currentIntervalStarted"] },
                      then: { $subtract: [new Date(), "$currentIntervalStarted"] },
                      else: 0
                    }
                  }
                ]
              }
            }
          },
          {
            $set: {
              intervals: {
                $cond: {
                  if: { $and: [{ $eq: ["$status", "ongoing"] }, "$currentIntervalStarted"] },
                  then: {
                    $concatArrays: [
                      "$intervals",
                      [
                        {
                          startTime: "$currentIntervalStarted",
                          endTime: new Date(),
                          duration: { $subtract: [new Date(), "$currentIntervalStarted"] }
                        }
                      ]
                    ]
                  },
                  else: "$intervals"
                }
              }
            }
          }
        ],
        {
          new: true, // Return updated document
          runValidators: true
        }
      );

      if (!updatedTimeLog) {
        return res.status(404).json({ message: "Active time log not found" });
      }

      // increment project member's hours
      const updatedProject = await BuildingProject.findOneAndUpdate(
        {
          _id: projectId,
          "members.user": memberId
        },
        {
          $inc: {
            "members.$.hours": updatedTimeLog.totalElapsedTime / (1000 * 60 * 60)
          }
        },
        {
          new: true
        }
      );

      res.status(200).json({
        message: "Time log stopped successfully",
        timeLog: updatedTimeLog,
        project: updatedProject
      });
    } catch (error) {
      res.status(500).json({
        message: "Error stopping time log",
        error: error.message
      });
    }
  };

  
  const getProjectTimeLogs = async (req, res) => {
    try {
      const { projectId, memberId } = req.params
      const matchStage = { project: projectId };
      if (memberId) {
        matchStage.member = memberId;
      }

      const timeLogs = await TimeLog.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: "users",
            localField: "member",
            foreignField: "_id",
            as: "member"
          }
        },
        { $unwind: "$member" },
        {
          $project: {
            _id: 1,
            project: 1,
            member: { firstName: "$member.firstName", lastName: "$member.lastName" },
            intervals: 1,
            status: 1,
            totalElapsedTime: 1,
            createdAt: 1
          }
        },
        { $sort: { createdAt: -1 } }
      ]);

      res.status(200).json(timeLogs);
    } catch (error) {
      res.status(500).json({
        message: "Error fetching time logs",
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