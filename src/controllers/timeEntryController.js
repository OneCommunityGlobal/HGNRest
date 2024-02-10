const moment = require('moment-timezone');
const mongoose = require('mongoose');
const { getInfringementEmailBody } = require('../helpers/userHelper')();
const UserProfile = require('../models/userProfile');
const Task = require('../models/task');
const WBS = require('../models/wbs');
const emailSender = require('../utilities/emailSender');
const { hasPermission } = require('../utilities/permissions');

const formatSeconds = function (seconds) {
  const formattedseconds = parseInt(seconds, 10);
  const values = `${Math.floor(
    moment.duration(formattedseconds, 'seconds').asHours(),
  )}:${moment.duration(formattedseconds, 'seconds').minutes()}`;
  return values.split(':');
};

const isGeneralTimeEntry = function (type) {
  if (type === undefined || type === 'default') {
    return true;
  }
  return false;
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
const getEditedTimeEntryEmailBody = (
  firstName,
  lastName,
  email,
  originalTime,
  finalTime,
  requestor,
) => {
  const formattedOriginal = moment
    .utc(originalTime * 1000)
    .format('HH[ hours ]mm[ minutes]');
  const formattedFinal = moment
    .utc(finalTime * 1000)
    .format('HH[ hours ]mm[ minutes]');
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
const notifyEditByEmail = async (personId, originalTime, finalTime, final) => {
  try {
    const record = await UserProfile.findById(personId);
    const requestor = personId !== final.requestor.requestorId
        ? await UserProfile.findById(final.requestor.requestorId)
        : record;
    const emailBody = getEditedTimeEntryEmailBody(
      record.firstName,
      record.lastName,
      record.email,
      originalTime,
      finalTime,
      requestor,
    );
    emailSender(
      'onecommunityglobal@gmail.com',
      `A Time Entry was Edited for ${record.firstName} ${record.lastName}`,
      emailBody,
    );
  } catch (error) {
    throw new Error(
      `Failed to send email notification about the modification of time entry belonging to user with id ${personId}`,
    );
  }
};

const notifyTaskOvertimeEmailBody = async (
  personId,
  taskName,
  estimatedHours,
  hoursLogged,
) => {
  try {
    const record = await UserProfile.findById(personId);
    const text = `Dear <b>${record.firstName}${record.lastName}</b>,
      <p>Oops, it looks like  you have logged more hours than estimated for a task </p>
      <p><b>Task Name : ${taskName}</b></p>
      <p><b>Time Estimated : ${estimatedHours}</b></p>
      <p><b>Hours Logged : ${hoursLogged.toFixed(2)}</b></p>
      <p><b>Please connect with your manager to explain what happened and submit a new hours estimation for completion.</b></p>
      <p>Thank you,</p>
      <p>One Community</p>`;
    emailSender(
      record.email,
      'Logged more hours than estimated for a task',
      text,
      'onecommunityglobal@gmail.com',
      null,
      record.email,
      null,
    );
  } catch (error) {
    console.log(
      `Failed to send email notification about the overtime for a task belonging to user with id ${personId}`,
    );
  }
};

const checkTaskOvertime = async (timeentry, currentUser, currentTask) => {
  try {
    // send email notification if logged in hours exceeds estiamted hours for a task
    if (currentTask.hoursLogged > currentTask.estimatedHours) {
      notifyTaskOvertimeEmailBody(
        timeentry.personId.toString(),
        currentTask.taskName,
        currentTask.estimatedHours,
        currentTask.hoursLogged,
      );
    }
  } catch (error) {
    console.log(
      `Failed to find task whose logged-in hours are more than estimated hours for ${currentUser.email}`,
    );
  }
};

// update timeentry with wbsId and taskId if projectId in the old timeentry is actually a taskId
const updateTaskIdInTimeEntry = async (id, timeEntry) => {
  // if id is a taskId, then timeentry should have the parent wbsId and projectId for that task;
  // if id is not a taskId, then it is a projectId, timeentry should have both wbsId and taskId to be null;
  let taskId = null;
  let wbsId = null;
  let projectId = id;
  const task = await Task.findById(id);
  if (task) {
    taskId = id;
    ({ wbsId } = task);
    const wbs = await WBS.findById(wbsId);
    ({ projectId } = wbs);
  }
  Object.assign(timeEntry, { taskId, wbsId, projectId });
};

const timeEntrycontroller = function (TimeEntry) {
  const editTimeEntry = async (req, res) => {
    const timeEntryId = req.body._id;
    if (!timeEntryId) {
      const error = 'ObjectId in request param is not in correct format';
      return res.status(400).send({ error });
    }

    const {
      personId,
      hours: newHours = '00',
      minutes: newMinutes = '00',
      notes: newNotes,
      isTangible: newIsTangible,
      projectId: newProjectId,
      wbsId: newWbsId,
      taskId: newTaskId,
      dateOfWork: newDateOfWork,
    } = req.body;

    const type = req.body.entryType;
    const isGeneralEntry = isGeneralTimeEntry(type);

    if (
      !mongoose.Types.ObjectId.isValid(timeEntryId)
      || ((isGeneralEntry || type === 'project')
        && !mongoose.Types.ObjectId.isValid(newProjectId))
    ) {
      const error = 'ObjectIds are not correctly formed';
      return res.status(400).send({ error });
    }

    const isForAuthUser = personId === req.body.requestor.requestorId;
    const isSameDayTimeEntry = moment().tz('America/Los_Angeles').format('YYYY-MM-DD') === newDateOfWork;
    const canEdit = (await hasPermission(req.body.requestor, 'editTimeEntry')) || (isForAuthUser && isSameDayTimeEntry);
    const canEditTimeEntryToggleTangible = await hasPermission(
      req.body.requestor,
      "editTimeEntryToggleTangible"
    );

    if (!(canEdit || canEditTimeEntryToggleTangible) ) {
      const error = 'Unauthorized request';
      return res.status(403).send({ error });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get initial timeEntry by timeEntryId
      const timeEntry = await TimeEntry.findById(timeEntryId);
      if (!timeEntry) {
        const error = `No valid records found for ${timeEntryId}`;
        return res.status(400).send({ error });
      }

      const newTotalSeconds = moment.duration({ hours: newHours, minutes: newMinutes }).asSeconds();

      if (isGeneralEntry && timeEntry.isTangible && newIsTangible && newTotalSeconds !== timeEntry.totalSeconds) {
        notifyEditByEmail(
          timeEntry.personId.toString(),
          timeEntry.totalSeconds,
          newTotalSeconds,
          req.body,
        );
      }

      // update task data if project/task is changed
      if (newTaskId === timeEntry.taskId && newProjectId === timeEntry.projectId) {
        // when project/task is the same
        const timeEntryTask = await Task.findById(newTaskId);
        if (timeEntryTask) {
          const timeEntryUser = await UserProfile.findById(personId);
          if (timeEntry.isTangible) {
            timeEntryTask.hoursLogged -= timeEntry.totalSeconds / 3600;
          }
          if (newIsTangible) {
            timeEntryTask.hoursLogged += newTotalSeconds / 3600;
          }
          checkTaskOvertime(timeEntry, timeEntryUser, timeEntryTask);
          await timeEntryTask.save();
        }
      } else {
        // update oldtTimeEntryTask
        const oldTimeEntryTask = await Task.findById(timeEntry.taskId);
        if (oldTimeEntryTask && timeEntry.isTangible) {
          oldTimeEntryTask.hoursLogged -= timeEntry.totalSeconds / 3600;
          oldTimeEntryTask.save();
        }
        // update newtTimeEntryTask
        const newTimeEntryTask = await Task.findById(newTaskId);
        if (newTimeEntryTask && newIsTangible) {
          const timeEntryUser = await UserProfile.findById(personId);
          newTimeEntryTask.hoursLogged += newTotalSeconds / 3600;
          checkTaskOvertime(timeEntry, timeEntryUser, newTimeEntryTask);
          await newTimeEntryTask.save();
        }
      }

      // Update edit history
      if ((isGeneralEntry || type === 'person')
        && timeEntry.totalSeconds !== newTotalSeconds
        && timeEntry.isTangible
        && isForAuthUser
        && !(await hasPermission(req.body.requestor, 'editTimeEntry'))
      ) {
        const requestor = await UserProfile.findById(
          req.body.requestor.requestorId,
        );

        requestor.timeEntryEditHistory.push({
          date: moment().tz('America/Los_Angeles').toDate(),
          initialSeconds: timeEntry.totalSeconds,
          newSeconds: newTotalSeconds,
        });

        if (isGeneralEntry) {
          // Issue infraction if edit history contains more than 5 edits in the last year
          let totalRecentEdits = 0;

          requestor.timeEntryEditHistory.forEach((edit) => {
            if (
              moment()
                .tz('America/Los_Angeles')
                .diff(edit.date, 'days') <= 365
            ) totalRecentEdits += 1;
          });

          if (totalRecentEdits >= 5) {
            requestor.infringements.push({
              date: moment().tz('America/Los_Angeles'),
              description: `${totalRecentEdits} time entry edits in the last calendar year`,
            });

            emailSender(
              'onecommunityglobal@gmail.com',
              `${requestor.firstName} ${requestor.lastName} was issued a blue square for for editing a time entry ${totalRecentEdits} times`,
              `
              <p>
                ${requestor.firstName} ${requestor.lastName} (${requestor.email}) was issued a blue square for editing their time entries ${totalRecentEdits} times
                within the last calendar year.
              </p>
              <p>
                This is the ${totalRecentEdits}th edit within the past 365 days.
              </p>
              `,
            );

            const emailInfringement = {
              date: moment().tz('America/Los_Angeles').format('MMMM-DD-YY'),
              description: `You edited your time entries ${totalRecentEdits} times within the last 365 days, exceeding the limit of 4 times per year you can edit them without penalty.`,
            };

            emailSender(
              requestor.email,
              "You've been issued a blue square for editing your time entry",
              getInfringementEmailBody(
                requestor.firstName,
                requestor.lastName,
                emailInfringement,
                requestor.infringements.length,
              ),
            );
          }
        }
        await requestor.save();
      }

      timeEntry.notes = newNotes;
      timeEntry.totalSeconds = newTotalSeconds;
      timeEntry.isTangible = newIsTangible;
      timeEntry.lastModifiedDateTime = moment().utc().toISOString();
      timeEntry.projectId = mongoose.Types.ObjectId(newProjectId);
      timeEntry.wbsId = newWbsId ? mongoose.Types.ObjectId(newWbsId) : null;
      timeEntry.taskId = newTaskId ? mongoose.Types.ObjectId(newTaskId) : null;
      timeEntry.dateOfWork = moment(newDateOfWork).format('YYYY-MM-DD');
      await timeEntry.save();

      return res.status(200).send(timeEntry);
    } catch (err) {
      await session.abortTransaction();
      return res.status(400).send({ error: err.toString() });
    } finally {
      session.endSession();
    }
  };

  const getAllTimeEnteries = function (req, res) {
    TimeEntry.find((err, records) => {
      if (err) {
        return res.status(404).send(err);
      }
      const items = [];
      records.forEach((element) => {
        const isGeneralEntry = isGeneralTimeEntry(element.entryType);
        if (isGeneralEntry) {
          const timeentry = new TimeEntry();
          timeentry.personId = element.personId;
          timeentry.projectId = element.projectId;
          timeentry.wbsId = element.wbsId;
          timeentry.taskId = element.taskId;
          timeentry.dateOfWork = element.dateOfWork;
          timeentry.timeSpent = moment('1900-01-01 00:00:00')
            .add(element.totalSeconds, 'seconds')
            .format('HH:mm:ss');
          timeentry.notes = element.notes;
          timeentry.isTangible = element.isTangible;
          timeentry.entryType = 'default';
          items.push(timeentry);
        }
      });
      return res.json(items).status(200);
    });
  };

  const postTimeEntry = async function (req, res) {
    const isInvalid = !req.body.dateOfWork
      || !moment(req.body.dateOfWork).isValid()
      || !req.body.timeSpent;

    const returnErr = (result) => {
      result.status(400).send({ error: 'Bad request' });
    };

    switch (req.body.entryType) {
      default:
        if (
          !mongoose.Types.ObjectId.isValid(req.body.personId)
          || !mongoose.Types.ObjectId.isValid(req.body.projectId)
          || isInvalid
        ) {
          returnErr(res);
        }
        break;
      case 'person':
        if (
          !mongoose.Types.ObjectId.isValid(req.body.personId) || isInvalid
        ) {
          returnErr(res);
        }
        break;
      case 'project':
        if (
          !mongoose.Types.ObjectId.isValid(req.body.projectId) || isInvalid
        ) {
          returnErr(res);
        }
        break;
      case 'team':
        if (
          !mongoose.Types.ObjectId.isValid(req.body.teamId) || isInvalid
        ) {
          returnErr(res);
        }
        break;
    }

    const timeEntry = new TimeEntry();
    const { dateOfWork, timeSpent } = req.body;
    timeEntry.personId = req.body.personId;
    timeEntry.projectId = req.body.projectId;
    timeEntry.wbsId = req.body.wbsId;
    timeEntry.taskId = req.body.taskId;
    timeEntry.teamId = req.body.teamId;
    timeEntry.dateOfWork = moment(dateOfWork).format('YYYY-MM-DD');
    timeEntry.totalSeconds = moment.duration(timeSpent).asSeconds();
    timeEntry.notes = req.body.notes;
    timeEntry.isTangible = req.body.isTangible;
    timeEntry.createdDateTime = moment().utc().toISOString();
    timeEntry.lastModifiedDateTime = moment().utc().toISOString();
    timeEntry.entryType = req.body.entryType;

    if (timeEntry.taskId) {
      const timeEntryTask = await Task.findById(timeEntry.taskId);
      const timeEntryUser = await UserProfile.findById(timeEntry.personId);
      if (timeEntry.isTangible) {
        timeEntryTask.hoursLogged += timeEntry.totalSeconds / 3600;
      }
      checkTaskOvertime(timeEntry, timeEntryUser, timeEntryTask);
      await timeEntryTask.save();
    }

    try {
      return timeEntry
        .save()
        .then(results => res.status(200).send({
            message: `Time Entry saved with id as ${results._id}`,
          }))
        .catch(error => res.status(400).send(error));
    } catch (error) {
      return res.status(500).send(error);
    }
  };

  const getTimeEntriesForSpecifiedPeriod = async function (req, res) {
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

    const fromdate = moment(req.params.fromdate)
      .tz('America/Los_Angeles')
      .format('YYYY-MM-DD');
    const todate = moment(req.params.todate)
      .tz('America/Los_Angeles')
      .format('YYYY-MM-DD');
    const { userId } = req.params;

    try {
      const timeEntries = await TimeEntry.find({
        entryType: { $in: ['default', null] },
        personId: userId,
        dateOfWork: { $gte: fromdate, $lte: todate },
      }).sort('-lastModifiedDateTime');

      const results = await Promise.all(timeEntries.map(async (timeEntry) => {
        timeEntry = { ...timeEntry.toObject() };
        const { projectId, taskId } = timeEntry;
        if (!taskId) await updateTaskIdInTimeEntry(projectId, timeEntry); // if no taskId, then it might be old time entry data that didn't separate projectId with taskId
        const hours = Math.floor(timeEntry.totalSeconds / 3600);
        const minutes = Math.floor((timeEntry.totalSeconds % 3600) / 60);
        Object.assign(timeEntry, { hours, minutes, totalSeconds: undefined });
        return timeEntry;
      }));

      res.status(200).send(results);
    } catch (error) {
      res.status(400).send({ error });
    }
  };

  const getTimeEntriesForUsersList = function (req, res) {
    const { users, fromDate, toDate } = req.body;

    TimeEntry.find(
      {
        entryType: { $in: ['default', null, 'person'] },
        personId: { $in: users },
        dateOfWork: { $gte: fromDate, $lte: toDate },
      },
      ' -createdDateTime',
    )
    .populate('personId')
    .populate('projectId')
    .populate('taskId')
    .populate('wbsId')
    .sort({ lastModifiedDateTime: -1 })
    .then((results) => {
      const data = [];

      results.forEach((element) => {
        const record = {};
        record._id = element._id;
        record.notes = element.notes;
        record.isTangible = element.isTangible;
        record.personId = element.personId._id;
        record.userProfile = element.personId;
        record.dateOfWork = element.dateOfWork;
        [record.hours, record.minutes] = formatSeconds(element.totalSeconds);
        record.projectId = element.projectId._id;
        record.projectName = element.projectId.projectName;
        record.projectCategory = element.projectId.category.toLowerCase();
        record.taskId = element.taskId?._id || null;
        record.taskName = element.taskId?.taskName || null;
        record.taskClassification = element.taskId?.classification?.toLowerCase() || null;
        record.wbsId = element.wbsId?._id || null;
        record.wbsName = element.wbsId?.wbsName || null;

        data.push(record);
      });

      res.status(200).send(data);
    })
    .catch((error) => {
      res.status(400).send(error);
    });
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
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  const deleteTimeEntry = async function (req, res) {
    if (!req.params.timeEntryId) {
      res.status(400).send({ error: 'Bad request' });
      return;
    }

    TimeEntry.findById(req.params.timeEntryId)
      .then(async (record) => {
        if (!record) {
          res.status(400).send({ message: 'No valid record found' });
          return;
        }

        if (record.entryType === 'project' || record.entryType === 'person' || record.entryType === 'team') {
          record
            .remove()
            .then(() => {
              res.status(200).send({ message: 'Successfully deleted' });
            })
            .catch((error) => {
              res.status(500).send(error);
            });
            return;
        }

        if (
          record.personId.toString()
            === req.body.requestor.requestorId.toString()
          || (await hasPermission(req.body.requestor, 'deleteTimeEntry'))
        ) {
          // Revert this tangible timeEntry of related task's hoursLogged
          if (record.isTangible === true) {
            Task
              .findById(record.projectId)
              .then((currentTask) => {
                // If the time entry isn't related to a task (i.e. it's a project), then don't revert hours (Most likely pr team)
                if (currentTask) {
                  currentTask.hoursLogged -= record.totalSeconds / 3600;
                  currentTask.save();
                }
              })
              .catch((error) => {
                throw new Error(error);
              });
          }

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

  const getLostTimeEntriesForUserList = function (req, res) {
    const { users, fromDate, toDate } = req.body;

    TimeEntry.find(
      {
        entryType: 'person',
        personId: { $in: users },
        dateOfWork: { $gte: fromDate, $lte: toDate },
      },
      ' -createdDateTime',
    )
      .populate('personId')
      .sort({ lastModifiedDateTime: -1 })
      .then((results) => {
        const data = [];
        results.forEach((element) => {
          const record = {};

          record._id = element._id;
          record.notes = element.notes;
          record.isTangible = element.isTangible;
          record.personId = element.personId;
          record.firstName = element.personId
            ? element.personId.firstName
            : '';
          record.lastName = element.personId
            ? element.personId.lastName
            : '';
          record.dateOfWork = element.dateOfWork;
          record.entryType = element.entryType;
          [record.hours, record.minutes] = formatSeconds(element.totalSeconds);
          data.push(record);
        });
        res.status(200).send(data);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  const getLostTimeEntriesForProjectList = function (req, res) {
    const { projects, fromDate, toDate } = req.body;

    TimeEntry.find(
      {
        entryType: 'project',
        projectId: { $in: projects },
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
          record.projectId = element.projectId ? element.projectId._id : '';
          record.projectName = element.projectId
            ? element.projectId.projectName
            : '';
          record.dateOfWork = element.dateOfWork;
          record.entryType = element.entryType;
          [record.hours, record.minutes] = formatSeconds(element.totalSeconds);
          data.push(record);
        });
        res.status(200).send(data);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  const getLostTimeEntriesForTeamList = function (req, res) {
    const { teams, fromDate, toDate } = req.body;

    TimeEntry.find(
      {
        entryType: 'team',
        teamId: { $in: teams },
        dateOfWork: { $gte: fromDate, $lte: toDate },
      },
      ' -createdDateTime',
    )
      .populate('teamId')
      .sort({ lastModifiedDateTime: -1 })
      .then((results) => {
        const data = [];
        results.forEach((element) => {
          const record = {};
          record._id = element._id;
          record.notes = element.notes;
          record.isTangible = element.isTangible;
          record.teamId = element.teamId ? element.teamId._id : '';
          record.teamName = element.teamId
            ? element.teamId.teamName
            : '';
          record.dateOfWork = element.dateOfWork;
          record.entryType = element.entryType;
          [record.hours, record.minutes] = formatSeconds(element.totalSeconds);
          data.push(record);
        });
        res.status(200).send(data);
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
    checkTaskOvertime,
    getLostTimeEntriesForUserList,
    getLostTimeEntriesForProjectList,
    getLostTimeEntriesForTeamList,
  };
};

module.exports = timeEntrycontroller;
