const moment = require('moment-timezone');
const mongoose = require('mongoose');
const logger = require('../startup/logger');

const UserProfile = require('../models/userProfile');

const meetingController = function (Meeting) {
  const postMeeting = async function (req, res) {
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
      meeting.locationDetails = req.body.locationDetails;
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
            locationDetails: 1,
            notes: 1,
            recipient: '$participantList.participant',
            isRead: '$participantList.notificationIsRead',
          },
        },
      ]);
      console.log(meetings[meetings.length-1]);
      
      res.status(200).json(meetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      res.status(500).json({ error: 'Failed to fetch meetings' });
    }
  };

  const markMeetingAsRead = async function (req, res) {
    try {
      const { meetingId, recipient } = req.params;
      const result = await Meeting.updateOne(
        { _id: meetingId, 'participantList.participant': recipient },
        { $set: { 'participantList.$.notificationIsRead': true } },
      );
      if (result.nModified === 0) {
        return res.status(404).json({ error: 'Meeting not found or already marked as read' });
      }
      res.status(200).json({ message: 'Meeting marked as read successfully' });
    } catch (error) {
      console.error('Error marking meeting as read:', error);
      res.status(500).json({ error: 'Failed to mark meeting as read' });
    }
  };

  const getAllMeetingsByOrganizer = async function (req, res) {
    try {
      const { organizerId } = req.query;
      if (!mongoose.Types.ObjectId.isValid(organizerId)) {
        return res.status(400).json({ error: 'Invalid organizer userId' });
      }
      const userProfileExists = await UserProfile.exists({ _id: organizerId });
      if (!userProfileExists) {
        throw new Error('Organizer ID does not exist');
      }

      const currentTime = new Date();
      const meetings = await Meeting.aggregate([
        {
          $match: {
            dateTime: { $gt: currentTime },
            organizer: mongoose.Types.ObjectId(organizerId),
          },
        },
        {
          $project: {
            _id: 1,
            dateTime: 1,
            duration: 1,
            organizer: 1,
            location: 1,
            locationDetails: 1,
            notes: 1,
            participantList: 1,
          },
        },
      ]);

      res.status(200).json(meetings);
    } catch (error) {
      console.error('Error fetching all upcoming meetings:', error);
      res.status(500).json({ error: 'Failed to fetch all upcoming meetings' });
    }
  };
  const getCalendarInvite = async (req, res) => {
    try {
      const { meetingId } = req.params;
      const meeting = await Meeting.findById(meetingId).populate('organizer');

      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }

      const organizerFullName = `${meeting.organizer.firstName} ${meeting.organizer.lastName}`;
      const startDate = new Date(meeting.dateTime);
      const endDate = new Date(startDate.getTime() + meeting.duration * 1000);
      const formatDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, '').toUpperCase();

      const googleCalendarLink = `https://calendar.google.com/calendar/u/0/r/eventedit?action=TEMPLATE&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${encodeURIComponent(meeting.notes)}&location=${encodeURIComponent(meeting.locationDetails)}&text=Meeting%20with%20${encodeURIComponent(organizerFullName)}`;

      const icsContent = `BEGIN:VCALENDAR
      VERSION:2.0
      PRODID:-//YourApp//Meeting Scheduler//EN
      BEGIN:VEVENT
      SUMMARY:Meeting with ${organizerFullName}
      LOCATION:${meeting.locationDetails}
      DTSTART:${formatDate(startDate)}
      DTEND:${formatDate(endDate)}
      DESCRIPTION:${meeting.notes}
      END:VEVENT
      END:VCALENDAR`;

      res.status(200).json({
        googleCalendarLink,
        icsContent,
        organizerFullName,
      });
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ error: 'Failed to fetch calendar invite' });
    }
  };

  const getUpcomingMeetingForParticipant = async function (req, res) {
    try {
      const { participantId } = req.params;
  
      // Use aggregate pipeline to fetch meetings for the participant
      const meetings = await Meeting.aggregate([
        { $unwind: '$participantList' }, // Must unwind before matching on nested field
        {
          $match: {
            'participantList.participant': mongoose.Types.ObjectId(participantId),
          },
        },
        {
          $project: {
            _id: 1, // this is the meeting ID
            dateTime: 1,
            duration: 1,
            organizer: 1,
            location: 1,
            locationDetails: 1,
            notes: 1,
            recipient: '$participantList.participant',
            isRead: '$participantList.notificationIsRead',
          },
        },
       // optional: ensures the list is sorted chronologically
      ]);
  
      if (meetings.length === 0) {
        return res.status(404).json({ error: 'No meetings found for this participant' });
      }
  
      const lastMeeting = meetings[meetings.length - 1];
  
      // Fetch full meeting document with organizer populated
      const meeting = await Meeting.findById(lastMeeting._id).populate('organizer');
  
      if (!meeting || !meeting.organizer) {
        return res.status(404).json({ error: 'Organizer information not found' });
      }
  
      const organizerName = `${meeting.organizer.firstName} ${meeting.organizer.lastName}`;
  
      // Send the last meeting and organizer name as response
      res.status(200).json({ lastMeeting, organizerName });
  
    } catch (error) {
      console.error('Error fetching meetings:', error);
      res.status(500).json({ error: 'Failed to fetch meetings' });
    }
  };
  
  
  
  
  
  
  
  
  
  


  return {
    postMeeting,
    getMeetings,
    markMeetingAsRead,
    getAllMeetingsByOrganizer,
    getCalendarInvite,
    getUpcomingMeetingForParticipant,
  };
};

module.exports = meetingController;
