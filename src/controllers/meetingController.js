const moment = require('moment-timezone');
const mongoose = require('mongoose');
const logger = require('../startup/logger');

const UserProfile = require('../models/userProfile');

const meetingController = function (Meeting) {
  const postMeeting = async function (req, res) {
    // console.log((!req.body.dateOfMeeting || !moment(req.body.dateOfMeeting).isValid()));
    // console.log(req.body.startHour == null);
    // console.log(req.body.startMinute == null);
    // console.log((!req.body.startTimePeriod || !['AM', 'PM'].includes(req.body.startTimePeriod)));
    // console.log(!req.body.duration);
    // console.log(!req.body.participantList || req.body.participantList.length === 0);
    // console.log((req.body.location && !['Zoom', 'Phone call', 'On-site'].includes(req.body.location)));

    const isInvalid =
      !req.body.dateOfMeeting ||
      !moment(req.body.dateOfMeeting).isValid() ||
      req.body.startHour == null ||
      req.body.startMinute == null ||
      !req.body.startTimePeriod ||
      !['AM', 'PM'].includes(req.body.startTimePeriod) ||
      !req.body.duration ||
      !req.body.organizer ||
      !req.body.participantList ||
      req.body.participantList.length === 0 ||
      (req.body.location && !['Zoom', 'Phone call', 'On-site'].includes(req.body.location));

    if (isInvalid) {
      return res.status(400).send({ error: 'Bad request: Invalid form values' });
    }

    try {
      await Promise.all(
        req.body.participantList.map(async (userProfileId) => {
          if (!mongoose.Types.ObjectId.isValid(userProfileId)) {
            throw new Error('Invalid participant ID');
          }
          const userProfileExists = await UserProfile.exists({ _id: userProfileId });
          if (!userProfileExists) {
            throw new Error('Participant ID does not exist');
          }
        }),
      );
      if (!mongoose.Types.ObjectId.isValid(req.body.organizer)) {
        throw new Error('Invalid organizer ID');
      }
      const organizerExists = await UserProfile.exists({ _id: req.body.organizer });
      if (!organizerExists) {
        throw new Error('Organizer ID does not exist');
      }
    } catch (error) {
      return res.status(400).send({ error: `Bad request: ${error.message}` });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const dateTimeString = `${req.body.dateOfMeeting} ${req.body.startHour}:${req.body.startMinute} ${req.body.startTimePeriod}`;
      const dateTimeISO = moment(dateTimeString, 'YYYY-MM-DD hh:mm A').toISOString();

      const meeting = new Meeting();
      meeting.dateTime = dateTimeISO;
      meeting.duration = req.body.duration;
      meeting.organizer = req.body.organizer;
      meeting.participantList = req.body.participantList.map((participant) => ({
        participant,
        notificationIsRead: false,
      }));
      meeting.location = req.body.location;
      meeting.notes = req.body.notes;

      await meeting.save({ session });
      await session.commitTransaction();
      session.endSession();
      res.status(201).json({ message: 'Meeting saved successfully' });
    } catch (err) {
      await session.abortTransaction();
      logger.logException(err);
      return res.status(500).send({ error: err.toString() });
    } finally {
      session.endSession();
    }
  };

  const getMeetings = async function (req, res) {
    try {
      const { startTime, endTime } = req.query;
      const decodedStartTime = decodeURIComponent(startTime);
      const decodedEndTime = decodeURIComponent(endTime);
      console.log('decodedStartTime', decodedStartTime);
      console.log('decodedEndTime', decodedEndTime);

      const meetings = await Meeting.aggregate([
        {
          $match: {
            dateTime: {
              $gte: new Date(decodedStartTime),
              $lte: new Date(decodedEndTime),
            },
          },
        },
        { $unwind: '$participantList' },
        {
          $project: {
            _id: 1,
            dateTime: 1,
            duration: 1,
            organizer: 1,
            location: 1,
            notes: 1,
            recipient: '$participantList.participant',
            isRead: '$participantList.notificationIsRead',
          },
        },
      ]);
      console.log('meetings', meetings);
      res.status(200).json(meetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      res.status(500).json({ error: 'Failed to fetch meetings' });
    }
  };

  const markMeetingAsRead = async function (req, res) {
    try {
      const { meetingId, recipient } = req.params;
      console.log('req.params', meetingId, recipient);
      const result = await Meeting.updateOne(
        { _id: meetingId, 'participantList.participant': recipient },
        { $set: { 'participantList.$.notificationIsRead': true } },
      );
      console.log(result);
      if (result.nModified === 0) {
        return res.status(404).json({ error: 'Meeting not found or already marked as read' });
      }
      res.status(200).json({ message: 'Meeting marked as read successfully' });
    } catch (error) {
      console.error('Error marking meeting as read:', error);
      res.status(500).json({ error: 'Failed to mark meeting as read' });
    }
  };

  return {
    postMeeting,
    getMeetings,
    markMeetingAsRead,
  };
};

module.exports = meetingController;
