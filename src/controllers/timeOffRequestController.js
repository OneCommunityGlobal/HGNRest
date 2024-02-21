const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { hasPermission } = require('../utilities/permissions');

const timeOffRequestController = function (TimeOffRequest) {
  const setTimeOffRequest = async (req, res) => {
    const hasRolePermission = ['Owner', 'Administrator'].includes(req.body.requestor.role);
    if (!await hasPermission(req.body.requestor, 'manageTimeOffRequests') && !hasRolePermission) {
      res.status(403).send('You are not authorized to set time off requests.');
      return;
    }
    const {
 duration, startingDate, reason, requestFor,
} = req.body;
    if (!duration || !startingDate || !reason || !requestFor) {
      res.status(400).send('bad request');
      return;
    }
    moment.tz.setDefault('America/Los_Angeles');

    const startDate = moment(startingDate);
    const endDate = startDate.clone().add(Number(duration), 'weeks').subtract(1, 'second');

    const newTimeOffRequest = new TimeOffRequest();

    newTimeOffRequest.requestFor = mongoose.Types.ObjectId(requestFor);
    newTimeOffRequest.reason = reason;
    newTimeOffRequest.startingDate = startDate.toDate();
    newTimeOffRequest.endingDate = endDate.toDate();
    newTimeOffRequest.duration = Number(duration);

    try {
      const savedRequest = await newTimeOffRequest.save();
      res.status(201).send(savedRequest);
    } catch (error) {
      res.status(500).send('Error saving the request.');
    }
  };

  const getTimeOffRequests = async (req, res) => {
    try {
      const allRequests = await TimeOffRequest.aggregate([
        {
          $sort: { requestFor: 1 }, // Sort by requestFor in ascending order
        },
        {
          $group: {
            _id: '$requestFor',
            requests: { $push: '$$ROOT' }, // Group requests by requestFor
          },
        },
        {
          $project: {
            _id: 0,
            requestFor: '$_id',
            requests: 1,
          },
        },
      ]);

      const formattedRequests = {};
      allRequests.forEach((request) => {
        formattedRequests[request.requestFor] = request.requests;
      });

      res.status(200).send(formattedRequests);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const getTimeOffRequestbyId = async (req, res) => {
    const requestId = req.params.id;

    try {
      const request = await TimeOffRequest.findById(requestId);

      if (!request) {
        res.status(404).send('Time off request not found');
        return;
      }

      res.status(200).send(request);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const updateTimeOffRequestById = async (req, res) => {
    const hasRolePermission = ['Owner', 'Administrator'].includes(req.body.requestor.role);
    if (!await hasPermission(req.body.requestor, 'manageTimeOffRequests') && !hasRolePermission) {
      res.status(403).send('You are not authorized to set time off requests.');
      return;
    }
    const requestId = req.params.id;
    const { duration, startingDate, reason } = req.body;
    if (!duration || !startingDate || !reason || !requestId) {
      res.status(400).send('bad request');
      return;
    }
    moment.tz.setDefault('America/Los_Angeles');

    const startDate = moment(startingDate);
    const endDate = startDate.clone().add(Number(duration), 'weeks').subtract(1, 'second');

    const updateData = {
      reason,
      startingDate: startDate.toDate(),
      endingDate: endDate.toDate(),
      duration,
    };

    try {
      const updatedRequest = await TimeOffRequest.findByIdAndUpdate(
        requestId,
        updateData,
        {
          new: true,
        },
      );

      if (!updatedRequest) {
        res.status(404).send('Time off request not found');
        return;
      }

      res.status(200).send(updatedRequest);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const deleteTimeOffRequestById = async (req, res) => {
    const hasRolePermission = ['Owner', 'Administrator'].includes(req.body.requestor.role);
    if (!await hasPermission(req.body.requestor, 'manageTimeOffRequests') && !hasRolePermission) {
      res.status(403).send('You are not authorized to set time off requests.');
      return;
    }
    const requestId = req.params.id;

    try {
      const deletedRequest = await TimeOffRequest.findByIdAndDelete(requestId);

      if (!deletedRequest) {
        res.status(404).send('Time off request not found');
        return;
      }

      res.status(200).send(deletedRequest);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  return {
    setTimeOffRequest,
    getTimeOffRequests,
    getTimeOffRequestbyId,
    updateTimeOffRequestById,
    deleteTimeOffRequestById,
  };
};

module.exports = timeOffRequestController;
