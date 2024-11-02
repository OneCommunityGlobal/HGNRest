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
    // console.log((!req.body.participantList || req.body.participantList.length < 2));
    // console.log((req.body.location && !['Zoom', 'Phone call', 'On-site'].includes(req.body.location)));

    const isInvalid =
      !req.body.dateOfMeeting ||
      !moment(req.body.dateOfMeeting).isValid() ||
      req.body.startHour == null ||
      req.body.startMinute == null ||
      !req.body.startTimePeriod ||
      !['AM', 'PM'].includes(req.body.startTimePeriod) ||
      !req.body.duration ||
      !req.body.participantList ||
      req.body.participantList.length < 2 ||
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

      // Continue with other operations if all IDs are valid
    } catch (error) {
      return res.status(400).send({ error: `Bad request: ${error.message}` });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const meeting = new Meeting();
      meeting.dateOfMeeting = moment(req.body.dateOfMeeting).format('YYYY-MM-DD');
      console.log(meeting.dateOfMeeting);
      meeting.startHour = req.body.startHour;
      meeting.startMinute = req.body.startMinute;
      meeting.startTimePeriod = req.body.startTimePeriod;
      meeting.duration = req.body.duration;
      meeting.participantList = req.body.participantList;
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

  return {
    postMeeting,
  };
};

module.exports = meetingController;
