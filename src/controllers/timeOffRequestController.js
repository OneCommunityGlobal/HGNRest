const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { hasPermission } = require('../utilities/permissions');
const emailSender = require('../utilities/emailSender');

const userNotificationEmail = (name, action = '') => {
  const message = action === 'delete'
      ? `<p>Hello,</p>
    <p>We wanted to inform you that your scheduled time-off request has been deleted.</p>
    <p>No further action is needed on your part regarding this request.</p>
    <p>Thank you,</p>
    <p>One Community</p>`
      : `<p>Hello,</p>
    <p>Thank you ${name} for scheduling your time off.</p> 
    <p>The Admin and your Managers have been notified of this request and no further action is needed on your part.</p>   
    <p>Thank you,</p>
    <p>One Community</p>`;
  return message;
};

const adminsNotificationEmail = (
  firstName,
  lastName,
  startDate,
  endDate,
  action = '',
) => {
  const message = action === 'delete'
      ? `<p>Hello,</p>
  <p>${firstName} ${lastName} had initially requested time off from ${moment(
          startDate,
        ).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}.</p>
  <p>We wanted to update you that this time-off request has been canceled.</p>
  <p>If any schedule adjustments or plans were made, please take note to revert them accordingly.</p>
  <p>Thank you for your understanding,</p>
  <p>One Community</p>`
      : `<p>Hello,</p>
    <p>${firstName} ${lastName} has requested the following week off: ${moment(
          startDate,
        ).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}</p>
    <p>If you need to, please make a note of this in your schedule and make any necessary plans for their action item(s).<br>
     As an additional reminder, their name in the Leaderboard and Tasks list will also reflect their absence for the time they are off.</p>
     <p>Thank you,</p>
    <p>One Community</p>`;
  return message;
};

const timeOffRequestController = function (TimeOffRequest, Team, UserProfile) {
  const notifyUser = async (userId, action = '') => {
    try {
      const user = await UserProfile.findById(
        userId,
        'firstName lastName email',
      );
      const { firstName, email } = user;

      emailSender(
        email,
        'Your requested time off has been scheduled!',
        userNotificationEmail(firstName, action),
        null,
        null,
        null,
      );
    } catch (err) {
      console.log(err);
    }
  };

  const notifyAdmins = async (startDate, endDate, userId, action = '') => {
    try {
      const user = await UserProfile.findById(
        userId,
        'firstName lastName',
      );
      const { firstName, lastName } = user;
      const userTeams = await Team.find({ 'members.userId': userId });

      const uniqueUserIds = {};

      userTeams.forEach((element) => {
        element.members.forEach((member) => {
          if (!uniqueUserIds[member.userId] && !member.userId.equals(userId)) {
            uniqueUserIds[member.userId] = true;
          }
        });
      });

      const uniqueUserIdsArray = Object.keys(uniqueUserIds);

      const userProfiles = await UserProfile.find({
        _id: { $in: uniqueUserIdsArray },
      });

      const rolesToInclude = ['Manager', 'Mentor', 'Administrator', 'Owner'];
      const userEmails = userProfiles.map((userProfile) => {
        if (rolesToInclude.includes(userProfile.role)) {
          return userProfile.email;
        }
          return null;
      });

      if (Array.isArray(userEmails) && userEmails.length > 0) {
        userEmails.forEach((email) => {
          emailSender(
            email,
            `Blue Square Reason for ${firstName} ${lastName} has been set`,
            adminsNotificationEmail(
              firstName,
              lastName,
              startDate,
              endDate,
              action,
            ),
            null,
            null,
            null,
          );
        });
      }
    } catch (err) {
      console.log(err);
    }
  };
  const setTimeOffRequest = async (req, res) => {
    try {
    const hasRolePermission = ['Owner', 'Administrator'].includes(req.body.requestor.role);
    const setOwnRequested = req.body.requestor.requestorId === req.body.requestFor;

    if (!(await hasPermission(req.body.requestor, 'manageTimeOffRequests')) && !hasRolePermission && !setOwnRequested) {
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
    const endDate = startDate.clone().add(Number(duration), 'weeks').subtract(1, 'day');

    const newTimeOffRequest = new TimeOffRequest();

    newTimeOffRequest.requestFor = mongoose.Types.ObjectId(requestFor);
    newTimeOffRequest.reason = reason;
    newTimeOffRequest.startingDate = startDate.toDate();
    newTimeOffRequest.endingDate = endDate.toDate();
    newTimeOffRequest.duration = Number(duration);

    const savedRequest = await newTimeOffRequest.save();
      res.status(201).send(savedRequest);
      if (savedRequest && setOwnRequested) {
        await notifyUser(requestFor);
        await notifyAdmins(startingDate, endDate, requestFor);
      }
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
    try {
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
    const endDate = startDate.clone().add(Number(duration), 'weeks').subtract(1, 'day');

    const updateData = {
      reason,
      startingDate: startDate.toDate(),
      endingDate: endDate.toDate(),
      duration,
    };

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
    try {
    const hasRolePermission = ['Owner', 'Administrator'].includes(req.body.requestor.role);
    const requestId = req.params.id;
    const document = await TimeOffRequest.findById(requestId);
    const deleteOwnRequest = document?.requestFor.toString() === req.body.requestor.requestorId;

    if (!await hasPermission(req.body.requestor, 'manageTimeOffRequests') && !hasRolePermission && !deleteOwnRequest) {
      res.status(403).send('You are not authorized to set time off requests.');
      return;
    }

      const deletedRequest = await TimeOffRequest.findByIdAndDelete(requestId);

      if (!deletedRequest) {
        res.status(404).send('Time off request not found');
        return;
      }

      res.status(200).send(deletedRequest);
      if (deleteOwnRequest) {
        await notifyUser(deletedRequest.requestFor, 'delete');
        await notifyAdmins(
          deletedRequest.startingDate,
          deletedRequest.endingDate,
          deletedRequest.requestFor,
          'delete',
        );
      }
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
