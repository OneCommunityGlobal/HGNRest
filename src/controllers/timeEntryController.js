const moment = require('moment-timezone');
const mongoose = require('mongoose');
const { getInfringmentEmailBody } = require('../helpers/userhelper')();
const userProfile = require('../models/userProfile');
const emailSender = require('../utilities/emailSender');
const hasPermission = require('../utilities/permissions');

const formatSeconds = function (seconds) {
  const formattedseconds = parseInt(seconds, 10);
  const values = `${Math.floor(
    moment.duration(formattedseconds, 'seconds').asHours(),
  )}:${moment.duration(formattedseconds, 'seconds').minutes()}`;
  return values.split(':');
};

/**
 *
 * @param {*} firstName First name of the owner of the time entry that was modified
 * @param {*} lastName First name of the owner of the time entry that was modified
 * @param {*} email Email of the owner of the time entry that was modified
 * @param {*} originalTime  The time (in seconds) of the original time entry
 * @param {*} finalTime The time (in seconds) of the updated time entry
 * @param {*} requestor The userProfile object of the person that modified the time entry
 * @returns {String}
 */
const getEditedTimeEntryEmailBody = (firstName, lastName, email, originalTime, finalTime, requestor) => {
  const formattedOriginal = moment.utc(originalTime * 1000).format('HH[ hours ]mm[ minutes]');
  const formattedFinal = moment.utc(finalTime * 1000).format('HH[ hours ]mm[ minutes]');
  return `
  A time entry belonging to ${firstName} ${lastName} (${email}) was modified by ${requestor.firstName} ${requestor.lastName} (${requestor.email}).
  The entry's duration was changed from [${formattedOriginal}] to [${formattedFinal}]
  `;
};

/**
 * Sends an email notification indicating that a user modified one of their own time entries
 * @param {*} personId The owner of the time entry that was modified
 * @param {*} original Original time entry object
 * @param {*} finalTime The time (in seconds) of the updated time entry
 * @param {*} final Final time entry object
 * @returns {Void}
 */
const notifyEditByEmail = async (personId, original, finalTime, final) => {
  try {
    const originalTime = original.totalSeconds;
    const record = await userProfile.findById(personId);
    const requestor = (personId !== final.requestor.requestorId) ? await userProfile.findById(final.requestor.requestorId) : record;
    const emailBody = getEditedTimeEntryEmailBody(record.firstName, record.lastName, record.email, originalTime, finalTime, requestor);
    emailSender('onecommunityglobal@gmail.com', `A Time Entry was Edited for ${record.firstName} ${record.lastName}`, emailBody);
  } catch (error) {
    console.log(`Failed to send email notification about the modification of time entry belonging to user with id ${personId}`);
  }
};

const timeEntrycontroller = function (TimeEntry) {
  const editTimeEntry = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!req.params.timeEntryId) {
        return res.status(400).send({ error: 'ObjectId in request param is not in correct format' });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.timeEntryId) || !mongoose.Types.ObjectId.isValid(req.body.projectId)) {
        return res.status(400).send({ error: 'ObjectIds are not correctly formed' });
      }

      const timeEntry = await TimeEntry.findById(req.params.timeEntryId);

      if (!timeEntry) {
        return res.status(400).send({ error: `No valid records found for ${req.params.timeEntryId}` });
      }

      if (!(hasPermission(req.body.requestor.role, 'editTimeEntry') || timeEntry.personId.toString() === req.body.requestor.requestorId.toString())) {
        return res.status(403).send({ error: 'Unauthorized request' });
      }

      const hours = req.body.hours ? req.body.hours : '00';
      const minutes = req.body.minutes ? req.body.minutes : '00';

      const totalSeconds = moment.duration(`${hours}:${minutes}`).asSeconds();

      if (timeEntry.isTangible === true && totalSeconds !== timeEntry.totalSeconds) {
        notifyEditByEmail(timeEntry.personId.toString(), timeEntry, totalSeconds, req.body);
      }

      const initialSeconds = timeEntry.totalSeconds;

      timeEntry.notes = req.body.notes;
      timeEntry.totalSeconds = totalSeconds;
      timeEntry.isTangible = req.body.isTangible;
      timeEntry.lastModifiedDateTime = moment().utc().toISOString();
      timeEntry.projectId = mongoose.Types.ObjectId(req.body.projectId);

      timeEntry.dateOfWork = moment(req.body.dateOfWork).format('YYYY-MM-DD');

      // Update edit history
      if (initialSeconds !== totalSeconds && timeEntry.isTangible && req.body.requestor.requestorId === timeEntry.personId.toString() && !hasPermission(req.body.requestor.role, 'editTimeEntry')) {
        const requestor = await userProfile.findById(req.body.requestor.requestorId);
        requestor.timeEntryEditHistory.push({
          date: moment().tz('America/Los_Angeles').toDate(),
          initialSeconds,
          newSeconds: totalSeconds,
        });

        // Issue infraction if edit history contains more than 5 edits in the last year
        let totalRecentEdits = 0;

        requestor.timeEntryEditHistory.forEach((edit) => {
          if (moment().tz('America/Los_Angeles').diff(edit.date, 'days') <= 365) {
            totalRecentEdits += 1;
          }
        });

        if (totalRecentEdits >= 5) {
          requestor.infringments.push({
            date: moment().tz('America/Los_Angeles'),
            description: `${totalRecentEdits} time entry edits in the last calendar year`,
          });

          emailSender('onecommunityglobal@gmail.com', `${requestor.firstName} ${requestor.lastName} was issued a blue square for for editing a time entry ${totalRecentEdits} times`, `
            <p>
              ${requestor.firstName} ${requestor.lastName} (${requestor.email}) was issued a blue square for editing their time entries ${totalRecentEdits} times
              within the last calendar year.
            </p>
            <p>
              This is the ${totalRecentEdits}th edit within the past 365 days.
            </p>
          `);

          const emailInfringement = {
            date: moment().tz('America/Los_Angeles').format('MMMM-DD-YY'),
            description: `You edited your time entries ${totalRecentEdits} times within the last 365 days, exceeding the limit of 4 times per year you can edit them without penalty.`,
          };

          emailSender(requestor.email, 'You\'ve been issued a blue square for editing your time entry', getInfringmentEmailBody(requestor.firstName, requestor.lastName, emailInfringement, requestor.infringments.length));
        }

        await requestor.save();
      }


      await timeEntry.save();

      res.status(200).send({ message: 'Successfully updated time entry' });
    } catch (err) {
      await session.abortTransaction();
      return res.status(400).send({ error: err.toString() });
    } finally {
      session.endSession();
    }

    return res.status(200).send();
  };

  const getAllTimeEnteries = function (req, res) {
    TimeEntry.find((err, records) => {
      if (err) {
        // console.log(err);
        return res.status(404).send(err);
      }
      const items = [];
      records.forEach((element) => {
        const timeentry = new TimeEntry();
        timeentry.personId = element.personId;
        timeentry.projectId = element.projectId;
        timeentry.dateOfWork = element.dateOfWork;
        timeentry.timeSpent = moment('1900-01-01 00:00:00')
          .add(element.totalSeconds, 'seconds')
          .format('HH:mm:ss');
        timeentry.notes = element.notes;
        timeentry.isTangible = element.isTangible;
        items.push(timeentry);
      });
      return res.json(items).status(200);
    });
  };

  const postTimeEntry = function (req, res) {
    if (
      !mongoose.Types.ObjectId.isValid(req.body.personId)
      || !mongoose.Types.ObjectId.isValid(req.body.projectId)
      || !req.body.dateOfWork
      || !moment(req.body.dateOfWork).isValid()
      || !req.body.timeSpent
      || !req.body.isTangible
    ) {
      res.status(400).send({ error: 'Bad request' });
      return;
    }
    const timeentry = new TimeEntry();
    const { dateOfWork, timeSpent } = req.body;
    timeentry.personId = req.body.personId;
    timeentry.projectId = req.body.projectId;
    timeentry.dateOfWork = moment(dateOfWork).format('YYYY-MM-DD');
    timeentry.totalSeconds = moment.duration(timeSpent).asSeconds();
    timeentry.notes = req.body.notes;
    timeentry.isTangible = req.body.isTangible;
    timeentry.createdDateTime = moment().utc().toISOString();
    timeentry.lastModifiedDateTime = moment().utc().toISOString();

    timeentry
      .save()
      .then((results) => {
        res
          .status(200)
          .send({ message: `Time Entry saved with id as ${results._id}` });
      })
      .catch(error => res.status(400).send(error));
  };

  const getTimeEntriesForSpecifiedPeriod = function (req, res) {
    if (
      !req.params
      || !req.params.fromdate
      || !req.params.todate
      || !req.params.userId
      || !moment(req.params.fromdate).isValid()
      || !moment(req.params.toDate).isValid()
    ) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }

    const fromdate = moment(req.params.fromdate).tz('America/Los_Angeles').format('YYYY-MM-DD');
    const todate = moment(req.params.todate).tz('America/Los_Angeles').format('YYYY-MM-DD');
    const { userId } = req.params;

    TimeEntry.find(
      {
        personId: userId,
        dateOfWork: { $gte: fromdate, $lte: todate },
      },
      ' -createdDateTime',
    )
      // allow the task-based timeEntry get its taskId into projectId field when calling this func
      // .populate('projectId')
      .sort({ lastModifiedDateTime: -1 })
      .then((results) => {
        const data = [];
        results.forEach((element) => {
          const record = {};

          record._id = element._id;
          record.notes = element.notes;
          record.isTangible = element.isTangible;
          record.personId = element.personId;
          record.projectId = element.projectId ? element.projectId._id : '';
          record.projectName = element.projectId
            ? element.projectId.projectName
            : '';
          record.dateOfWork = element.dateOfWork;
          [record.hours, record.minutes] = formatSeconds(element.totalSeconds);
          data.push(record);
        });
        res.status(200).send(data);
      })
      .catch(error => res.status(400).send(error));
  };

  const getTimeEntriesForUsersList = function (req, res) {
    const { members } = req.query;
    const membersArr = members.split(',');
    // console.log(membersArr);

    const fromDate = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .subtract(0, 'weeks')
      .format('YYYY-MM-DD');

    const toDate = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .subtract(0, 'weeks')
      .format('YYYY-MM-DD');

    TimeEntry.find(
      {
        personId: { $in: membersArr },
        dateOfWork: { $gte: fromDate, $lte: toDate },
      },
      ' -createdDateTime',
    )
      .populate('projectId')
      .sort({ lastModifiedDateTime: -1 })
      .then((results) => {
        const data = [];
        results.forEach((element) => {
          const record = {};

          record._id = element._id;
          record.notes = element.notes;
          record.isTangible = element.isTangible;
          record.personId = element.personId;
          record.projectId = element.projectId ? element.projectId._id : '';
          record.projectName = element.projectId
            ? element.projectId.projectName
            : '';
          record.dateOfWork = element.dateOfWork;
          [record.hours, record.minutes] = formatSeconds(element.totalSeconds);
          data.push(record);
        });
        res.status(200).send(data);
      })
      .catch(error => res.status(400).send(error));
  };
  const getTimeEntriesForSpecifiedProject = function (req, res) {
    if (
      !req.params
      || !req.params.fromDate
      || !req.params.toDate
      || !req.params.projectId
    ) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }
    const todate = moment(req.params.toDate).format('YYYY-MM-DD');
    const fromDate = moment(req.params.fromDate).format('YYYY-MM-DD');
    const { projectId } = req.params;
    TimeEntry.find(
      {
        projectId,
        dateOfWork: { $gte: fromDate, $lte: todate },
      },
      '-createdDateTime -lastModifiedDateTime',
    )
      .populate('userId')
      .sort({ dateOfWork: -1 })
      .then((results) => {
        res.status(200).send(results);
      })
      .catch(error => res.status(400).send(error));
  };

  const deleteTimeEntry = function (req, res) {
    if (!req.params.timeEntryId) {
      res.status(400).send({ error: 'Bad request' });
      return;
    }

    TimeEntry.findById(req.params.timeEntryId)
      .then((record) => {
        if (!record) {
          res.status(400).send({ message: 'No valid record found' });
          return;
        }

        if (
          record.personId.toString()
            === req.body.requestor.requestorId.toString()
          || hasPermission(req.body.requestor.role, 'deleteTimeEntry')
        ) {
          record
            .remove()
            .then(() => {
              res.status(200).send({ message: 'Successfully deleted' });
            })
            .catch((error) => {
              res.status(500).send(error);
            });
        } else {
          res.status(403).send({ error: 'Unauthorized request' });
        }
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  return {
    getAllTimeEnteries,
    postTimeEntry,
    getTimeEntriesForSpecifiedPeriod,
    getTimeEntriesForUsersList,
    editTimeEntry,
    deleteTimeEntry,
    getTimeEntriesForSpecifiedProject,
  };
};

module.exports = timeEntrycontroller;
