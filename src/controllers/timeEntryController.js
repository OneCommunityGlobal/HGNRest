const moment = require('moment-timezone');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const logger = require('../startup/logger');
const UserProfile = require('../models/userProfile');
const Project = require('../models/project');
const Task = require('../models/task');
const WBS = require('../models/wbs');
const emailSender = require('../utilities/emailSender');
const { hasPermission } = require('../utilities/permissions');
const cacheClosure = require('../utilities/nodeCache');

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
 * Get the email body for a time entry that was edited
 * @param {*} targetUser The user profile object of the user that owns the time entry
 * @param {*} requestor The user profile object of the user that modified the time entry
 * @param {*} originalTime The time (in seconds) of the original time entry
 * @param {*} finalTime The time (in seconds) of the updated time entry
 * @param {*} originalDateOfWork The original date of work for the time entry
 * @param {*} finalDateOfWork The updated date of work for the time entry
 * @returns {String} The email body
 */
const getEditedTimeEntryEmailBody = (
  targetUser,
  requestor,
  originalTime,
  finalTime,
  originalDateOfWork = null,
  finalDateOfWork = null,
) => {
  const formattedOriginal = moment.utc(originalTime * 1000).format('HH[ hours ]mm[ minutes]');
  const formattedFinal = moment.utc(finalTime * 1000).format('HH[ hours ]mm[ minutes]');
  return `
  A time entry belonging to ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email}) was modified by ${requestor.firstName} ${requestor.lastName} (${requestor.email}).
  The entry's duration was changed from [${formattedOriginal}] to [${formattedFinal}]
  ${originalDateOfWork ? `The entry's date of work was changed from ${originalDateOfWork} to ${finalDateOfWork}` : ''}`;
};

/**
 * Sends an email notification indicating that a user modified one of their own time entries
 * @param {*} userprofile The user profile object of the user that owns the time entry
 * @param {*} requstorId The id of the user that modified the time entry
 * @param {*} originalTime The time (in seconds) of the original time entry
 * @param {*} finalTime The time (in seconds) of the updated time entry
 * @param {*} originalDateOfWork The original date of work for the time entry
 * @param {*} finalDateOfWork The updated date of work for the time entry
 * @returns {Void}
 */
const notifyEditByEmail = async (
  userprofile,
  requstorId,
  originalTime,
  finalTime,
  originalDateOfWork = null,
  finalDateOfWork = null,
) => {
  try {
    const requestor =
      requstorId === userprofile._id.toString()
        ? userprofile
        : await UserProfile.findById(requstorId);
    const emailBody = getEditedTimeEntryEmailBody(
      userprofile,
      requestor,
      originalTime,
      finalTime,
      originalDateOfWork,
      finalDateOfWork,
    );
    emailSender(
      'onecommunityglobal@gmail.com',
      `A Time Entry was Edited for ${userprofile.firstName} ${userprofile.lastName}`,
      emailBody,
    );
  } catch (error) {
    throw new Error(
      `Failed to send email notification about the modification of time entry belonging to user with id ${userprofile._id.toString()}`,
    );
  }
};

/**
 * Sends an email notification indicating that a user logged more hours than estimated for a task
 * @param {*} userProfile The user profile object of the user that owns the time entry
 * @param {*} task The task object that the user logged time for
 * @returns {Void}
 */
const notifyTaskOvertimeEmailBody = async (userProfile, task) => {
  const { taskName, estimatedHours, hoursLogged } = task;
  try {
    const text = `Dear <b>${userProfile.firstName}${userProfile.lastName}</b>,
      <p>Oops, it looks like  you have logged more hours than estimated for a task </p>
      <p><b>Task Name : ${taskName}</b></p>
      <p><b>Time Estimated : ${estimatedHours}</b></p>
      <p><b>Hours Logged : ${hoursLogged.toFixed(2)}</b></p>
      <p><b>Please connect with your manager to explain what happened and submit a new hours estimation for completion.</b></p>
      <p>Thank you,</p>
      <p>One Community</p>`;
    emailSender(
      userProfile.email,
      'Logged more hours than estimated for a task',
      text,
      'onecommunityglobal@gmail.com',
      null,
      userProfile.email,
      null,
    );
  } catch (error) {
    throw new Error(
      `Failed to send email notification about the modification of time entry belonging to user with id ${userProfile._id}`,
    );
  }
};

/**
 * Update task hoursLogged for a time entry
 * @param {*} fromTaskId The id of the task that the time entry is moving from
 * @param {*} secondsToBeRemoved The total seconds of the time entry that is moving from
 * @param {*} toTaskId The id of the task that the time entry is moving to
 * @param {*} secondsToBeAdded The total seconds of the time entry that is moving to
 * @param {*} userprofile The userprofile object
 * @param {*} session The session object
 * @param {*} pendingEmailCollection The collection of email functions to be executed after the transaction
 * @returns {Void}
 */
const updateTaskLoggedHours = async (
  fromTaskId,
  secondsToBeRemoved,
  toTaskId,
  secondsToBeAdded,
  userprofile,
  session,
  pendingEmailCollection = null,
) => {
  // if both fromTaskId and toTaskId are null, then there is no need to update task hoursLogged
  if (!fromTaskId && !toTaskId) return;

  const hoursToBeRemoved = secondsToBeRemoved ? Number((secondsToBeRemoved / 3600).toFixed(2)) : 0;
  const hoursToBeAdded = secondsToBeAdded ? Number((secondsToBeAdded / 3600).toFixed(2)) : 0;
  if (fromTaskId && toTaskId && fromTaskId !== toTaskId) {
    // update from one task to another
    try {
      await Task.findOneAndUpdate(
        { _id: fromTaskId },
        { $inc: { hoursLogged: -hoursToBeRemoved } },
        { new: true, session },
      );
      const toTask = await Task.findOneAndUpdate(
        { _id: toTaskId },
        { $inc: { hoursLogged: hoursToBeAdded } },
        { new: true, session },
      );
      if (toTask.hoursLogged > toTask.estimatedHours && pendingEmailCollection) {
        pendingEmailCollection.push(notifyTaskOvertimeEmailBody.bind(null, userprofile, toTask));
      }
    } catch (error) {
      throw new Error(
        `Failed to update task hoursLogged from task with id ${fromTaskId} to task with id ${toTaskId}`,
      );
    }
  } else if (fromTaskId === toTaskId) {
    // update within the same task
    const hoursDiff = hoursToBeAdded - hoursToBeRemoved;
    try {
      const updatedTask = await Task.findOneAndUpdate(
        { _id: toTaskId },
        { $inc: { hoursLogged: hoursDiff } },
        { new: true, session },
      );
      if (updatedTask.hoursLogged > updatedTask.estimatedHours && pendingEmailCollection) {
        pendingEmailCollection.push(
          notifyTaskOvertimeEmailBody.bind(null, userprofile, updatedTask),
        );
      }
    } catch (error) {
      throw new Error(`Failed to update task hoursLogged for task with id ${toTaskId}`);
    }
  } else {
    // only remove hours from the old task or add hours to the new task
    // in this case, only one of fromTaskId or toTaskId will be truthy, and only one of secondsToBeRemoved or secondsToBeAdded will be truthy
    try {
      const updatedTask = await Task.findOneAndUpdate(
        { _id: fromTaskId || toTaskId },
        { $inc: { hoursLogged: -hoursToBeRemoved || hoursToBeAdded } },
        { new: true, session },
      );
      if (
        toTaskId &&
        updatedTask.hoursLogged > updatedTask.estimatedHours &&
        pendingEmailCollection
      ) {
        pendingEmailCollection.push(
          notifyTaskOvertimeEmailBody.bind(null, userprofile, updatedTask),
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to update task hoursLogged for task with id ${fromTaskId || toTaskId}`,
      );
    }
  }
};

/**
 * Update userprofile hoursByCategory due to project change or posting time entry
 * @param {*} userprofile The userprofile object
 * @param {*} fromProjectId The id of the project that the time entry is moving from
 * @param {*} secondsToBeRemoved The total seconds of the time entry that is moving from
 * @param {*} toProjectId The id of the project that the time entry is moving to
 * @param {*} secondsToBeAdded The total seconds of the time entry that is moving to
 * @returns {Void}
 */
const updateUserprofileCategoryHrs = async (
  fromProjectId,
  secondsToBeRemoved,
  toProjectId,
  secondsToBeAdded,
  userprofile,
) => {
  if (fromProjectId) {
    const fromProject = await Project.findById(fromProjectId);
    const hoursToBeRemoved = Number((secondsToBeRemoved / 3600).toFixed(2));
    if (fromProject.category.toLowerCase() in userprofile.hoursByCategory) {
      userprofile.hoursByCategory[fromProject.category.toLowerCase()] -= hoursToBeRemoved;
    } else {
      userprofile.hoursByCategory.unassigned -= hoursToBeRemoved;
    }
  }
  if (toProjectId) {
    const toProject = await Project.findById(toProjectId);
    const hoursToBeAdded = Number((secondsToBeAdded / 3600).toFixed(2));
    if (toProject.category.toLowerCase() in userprofile.hoursByCategory) {
      userprofile.hoursByCategory[toProject.category.toLowerCase()] += hoursToBeAdded;
    } else {
      userprofile.hoursByCategory.unassigned += hoursToBeAdded;
    }
  }
};

/**
 * Update userprofile tangible and intangible hours
 * @param {*} tangibleSecondsChanged The total seconds of the tangible time entry that is moving
 * @param {*} intangibleSecondsChanged The total seconds of the intangible time entry that is moving
 * @param {*} userprofile The userprofile object
 * @returns {Void}
 */
const updateUserprofileTangibleIntangibleHrs = (
  tangibleSecondsChanged,
  intangibleSecondsChanged,
  userprofile,
) => {
  const tangibleHoursChanged = Number((tangibleSecondsChanged / 3600).toFixed(2));
  const intangibleHoursChanged = Number((intangibleSecondsChanged / 3600).toFixed(2));
  userprofile.totalIntangibleHrs += intangibleHoursChanged;
  userprofile.totalTangibleHrs += tangibleHoursChanged;
};

/**
 * Remove outdated userprofile cache
 * @param {*} userprofile The userprofile object
 * @returns {Void}
 */
const removeOutdatedUserprofileCache = (userId) => {
  const userprofileCache = cacheClosure();
  userprofileCache.removeCache(`user-${userId}`);
};

/**
 * Validate userprofile hours, including totalTangibleHrs, totalIntangibleHrs, and hoursByCategory
 * @param {*} userprofile The userprofile object
 * @returns {Void}
 */
const validateUserprofileHours = (userprofile) => {
  if (userprofile.totalTangibleHrs < 0) userprofile.totalTangibleHrs = 0;
  if (userprofile.totalIntangibleHrs < 0) userprofile.totalIntangibleHrs = 0;
  Object.keys(userprofile.hoursByCategory).forEach((category) => {
    if (userprofile.hoursByCategory[category] < 0) userprofile.hoursByCategory[category] = 0;
  });
};

/**
 * Add an edit history to the userprofile
 * @param {*} userprofile The userprofile object
 * @param {*} initialTotalSeconds The total seconds of the time entry before the edit
 * @param {*} newTotalSeconds The total seconds of the time entry after the edit
 * @param {*} originalDateOfWork The original date of work for the time entry
 * @param {*} finalDateOfWork The updated date of work for the time entry
 * @param {*} pendingEmailCollection The collection of email functions to be executed
 * @returns {Void}
 */
const addEditHistory = async (
  userprofile,
  initialTotalSeconds,
  newTotalSeconds,
  originalDateOfWork,
  finalDateOfWork,
  pendingEmailCollection,
) => {
  userprofile.timeEntryEditHistory.push({
    date: moment().tz('America/Los_Angeles').toDate(),
    initialSeconds: initialTotalSeconds,
    newSeconds: newTotalSeconds,
    originalDateOfWork,
    finalDateOfWork,
  });
  // Issue infraction if edit history contains more than 5 edits in the last year
  const totalRecentEdits = userprofile.timeEntryEditHistory.filter(
    (edit) => moment().tz('America/Los_Angeles').diff(edit.date, 'days') <= 365,
  ).length;

  if (totalRecentEdits >= 5) {
    const cutOffDate = moment().subtract(1, 'year');
    const recentInfringements = userprofile.infringements.filter((infringement) =>
      moment(infringement.date).isAfter(cutOffDate),
    );
    let modifiedRecentInfringements = 'No Previous Infringements!';
    if (recentInfringements.length) {
      modifiedRecentInfringements = recentInfringements
        .map((item, index) => {
          let enhancedDescription;
          if (item.description) {
            let sentences = item.description.split('.');
            const dateRegex =
              /in the week starting Sunday (\d{4})-(\d{2})-(\d{2}) and ending Saturday (\d{4})-(\d{2})-(\d{2})/g;
            sentences = sentences.map((sentence) =>
              sentence.replace(dateRegex, (match, year1, month1, day1, year2, month2, day2) => {
                const startDate = moment(`${year1}-${month1}-${day1}`, 'YYYY-MM-DD').format(
                  'M-D-YYYY',
                );
                const endDate = moment(`${year2}-${month2}-${day2}`, 'YYYY-MM-DD').format(
                  'M-D-YYYY',
                );
                return `in the week starting Sunday ${startDate} and ending Saturday ${endDate}`;
              }),
            );
            if (sentences[0].includes('System auto-assigned infringement for two reasons')) {
              sentences[0] = sentences[0].replace(
                /(not meeting weekly volunteer time commitment as well as not submitting a weekly summary)/gi,
                '<span style="color: blue;"><b>$1</b></span>',
              );
              enhancedDescription = sentences.join('.');
              enhancedDescription = enhancedDescription.replace(
                /logged (\d+(\.\d+)?\s*hours)/i,
                'logged <span style="color: blue;"><b>$1</b></span>',
              );
            } else if (
              sentences[0].includes(
                'System auto-assigned infringement for editing your time entries',
              )
            ) {
              sentences[0] = sentences[0].replace(
                /time entries <(\d+)>\s*times/i,
                'time entries <span><b>$1 times</b></span>',
              );
              enhancedDescription = sentences.join('.');
            } else if (sentences[0].includes('System auto-assigned infringement')) {
              sentences[0] = sentences[0].replace(
                /(not submitting a weekly summary)/gi,
                '<span style="color: blue;"><b>$1</b></span>',
              );
              sentences[0] = sentences[0].replace(
                /(not meeting weekly volunteer time commitment)/gi,
                '<span style="color: blue;"><b>$1</b></span>',
              );
              enhancedDescription = sentences.join('.');
              enhancedDescription = enhancedDescription.replace(
                /logged (\d+(\.\d+)?\s*hours)/i,
                'logged <span style="color: blue;"><b>$1</b></span>',
              );
            } else {
              enhancedDescription = `<span style="color: blue;"><b>${item.description}</b></span>`;
            }
          }
          return `<p>${index + 1}. Date: <span style="color: blue;"><b>${moment(item.date).format(
            'M-D-YYYY',
          )}</b></span>, Description: ${enhancedDescription}</p>`;
        })
        .join('');
    }

    userprofile.infringements.push({
      date: moment().tz('America/Los_Angeles'),
      description: `System auto-assigned infringement for editing your time entries <${totalRecentEdits}> times within the last 365 days, exceeding the limit of 4 times per year you can edit them without penalty.
     time entry edits in the last calendar year`,
    });

    const infringementNotificationToAdminEmailBody = `
    <p>
      ${userprofile.firstName} ${userprofile.lastName} (${userprofile.email}) was issued a blue square for editing their time entries ${totalRecentEdits} times
      within the last calendar year.
    </p>
    <p>
      This is the ${totalRecentEdits}th edit within the past 365 days.
    </p>
    `;

    const infringementNotificationToUserEmailBody = `Dear <b>${userprofile.firstName} ${userprofile.lastName}</b>,
        <p>Oops, it looks like you chose to edit your time entries too many times and you’ve managed to get a blue square.</p>
        <p><b>Date Assigned:</b> ${moment().tz('America/Los_Angeles').format('M-D-YYYY')}</p>\
        <p><b>Description:</b> System auto-assigned infringement for editing your time entries <b>${totalRecentEdits} times</b> within the last 365 days, exceeding the limit of 4 times per year you can edit them without penalty.</p>
        <p><b>Total Infringements:</b> This is your <b>${moment
          .localeData()
          .ordinal(recentInfringements.length)}</b> blue square of 5.</p>
        <p>Thank you,<p>
        <p>One Community</p>
        <!-- Adding multiple non-breaking spaces -->
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <hr style="border-top: 1px dashed #000;"/>
        <p><b>ADMINISTRATIVE DETAILS:</b></p>
        <p><b>Start Date:</b> ${moment(userprofile.startDate).utc().format('M-D-YYYY')}</p>
        <p><b>Role:</b> ${userprofile.role}</p>
        <p><b>Title:</b> ${userprofile.userTitle || 'Volunteer'} </p>
        <p><b>Previous Blue Square Reasons: </b></p>
        ${modifiedRecentInfringements}`;

    pendingEmailCollection.push(
      emailSender.bind(
        null,
        'onecommunityglobal@gmail.com',
        `${userprofile.firstName} ${userprofile.lastName} was issued a blue square for for editing a time entry ${totalRecentEdits} times`,
        infringementNotificationToAdminEmailBody,
      ),
      emailSender.bind(
        null,
        userprofile.email,
        'You’ve been issued a blue square for editing your time entries too many times',
        infringementNotificationToUserEmailBody,
      ),
    );
  }
};

/**
 * Update timeEntry with wbsId and taskId if projectId in the old timeentry is actually a taskId
 * @param {*} id The id of the time entry
 * @param {*} timeEntry The time entry object
 * @returns {Void}
 */
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

/**
 * Controller for timeEntry
 */
const timeEntrycontroller = function (TimeEntry) {
  /**
   * Helper func: Check if this is the first time entry for the given user id
   *
   * @param {Mongoose.ObjectId} personId
   * @returns
   */
  const checkIsUserFirstTimeEntry = async (personId) => {
    try {
      const timeEntry = await TimeEntry.findOne({
        personId,
      });
      if (timeEntry) {
        return false;
      }
    } catch (error) {
      throw new Error(`Failed to check user with id ${personId} on time entry`);
    }
    return true;
  };

  /**
   * Post a time entry
   */
  const postTimeEntry = async function (req, res) {
    const isInvalid =
      !req.body.dateOfWork ||
      !moment(req.body.dateOfWork).isValid() ||
      !(req.body.hours || req.body.minutes);

    const returnErr = (result) => {
      result.status(400).send({ error: 'Bad request' });
    };

    const isPostingForSelf = req.body.personId === req.body.requestor.requestorId;
    const canPostTimeEntriesForOthers = await hasPermission(req.body.requestor, 'postTimeEntry');
    if (!isPostingForSelf && !canPostTimeEntriesForOthers) {
      res.status(403).send({ error: 'You do not have permission to post time entries for others' });
      return;
    }

    switch (req.body.entryType) {
      case 'person':
        if (!mongoose.Types.ObjectId.isValid(req.body.personId) || isInvalid) returnErr(res);
        break;
      case 'project':
        if (!mongoose.Types.ObjectId.isValid(req.body.projectId) || isInvalid) returnErr(res);
        break;
      case 'team':
        if (!mongoose.Types.ObjectId.isValid(req.body.teamId) || isInvalid) returnErr(res);
        break;
      default:
        if (
          !mongoose.Types.ObjectId.isValid(req.body.personId) ||
          !mongoose.Types.ObjectId.isValid(req.body.projectId) ||
          isInvalid
        )
          returnErr(res);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    const pendingEmailCollection = [];
    try {
      const timeEntry = new TimeEntry();
      const now = moment().utc().toISOString();

      timeEntry.personId = req.body.personId;
      timeEntry.projectId = req.body.projectId;
      timeEntry.wbsId = req.body.wbsId;
      timeEntry.taskId = req.body.taskId;
      timeEntry.teamId = req.body.teamId;
      timeEntry.dateOfWork = moment(req.body.dateOfWork).format('YYYY-MM-DD');
      timeEntry.totalSeconds = moment
        .duration({ hours: req.body.hours, minutes: req.body.minutes })
        .asSeconds();
      timeEntry.notes = req.body.notes;
      timeEntry.isTangible = req.body.isTangible;
      timeEntry.createdDateTime = now;
      timeEntry.lastModifiedDateTime = now;
      timeEntry.entryType = req.body.entryType;

      const userprofile = await UserProfile.findById(timeEntry.personId);

      if (userprofile) {
        // if the time entry is tangible, update the tangible hours in the user profile
        if (timeEntry.isTangible) {
          // update the total tangible hours in the user profile and the hours by category
          updateUserprofileTangibleIntangibleHrs(timeEntry.totalSeconds, 0, userprofile);
          await updateUserprofileCategoryHrs(
            null,
            null,
            timeEntry.projectId,
            timeEntry.totalSeconds,
            userprofile,
          );
          // if the time entry is related to a task, update the task hoursLogged
          if (timeEntry.taskId) {
            updateTaskLoggedHours(
              timeEntry.taskId,
              0,
              timeEntry.taskId,
              timeEntry.totalSeconds,
              userprofile,
              session,
              pendingEmailCollection,
            );
          }
        } else {
          // if the time entry is intangible, just update the intangible hours in the userprofile
          updateUserprofileTangibleIntangibleHrs(0, timeEntry.totalSeconds, userprofile);
        }
      }

      // Replace the isFirstTimelog checking logic from the frontend to the backend
      // Update the user start date to current date if this is the first time entry (Weekly blue square assignment related)
      const isFirstTimeEntry = await checkIsUserFirstTimeEntry(timeEntry.personId);
      if (isFirstTimeEntry) {
        userprofile.isFirstTimelog = false;
        userprofile.startDate = now;
      }

      await timeEntry.save({ session });
      if (userprofile) {
        await userprofile.save({ session, validateModifiedOnly: true });
        // since userprofile is updated, need to remove the cache so that the updated userprofile is fetched next time
        removeOutdatedUserprofileCache(userprofile._id.toString());
      }

      await session.commitTransaction();
      pendingEmailCollection.forEach((emailHandler) => emailHandler());
      return res.status(200).send({
        message: 'Time Entry saved successfully',
      });
    } catch (err) {
      await session.abortTransaction();
      logger.logException(err);
      return res.status(500).send({ error: err.toString() });
    } finally {
      session.endSession();
    }
  };

  /**
   * Edit a time entry
   */
  const editTimeEntry = async (req, res) => {
    const { timeEntryId } = req.params;

    if (!timeEntryId) {
      const error = 'ObjectId in request param is not in correct format';
      return res.status(400).send({ error });
    }

    const {
      personId,
      hours: newHours,
      minutes: newMinutes,
      notes: newNotes,
      isTangible: newIsTangible,
      projectId: newProjectId,
      wbsId: newWbsId,
      taskId: newTaskId,
      dateOfWork: newDateOfWork,
    } = req.body;

    const newTotalSeconds = newHours * 3600 + newMinutes * 60;
    const type = req.body.entryType;
    const isGeneralEntry = isGeneralTimeEntry(type);

    if (
      !mongoose.Types.ObjectId.isValid(timeEntryId) ||
      ((isGeneralEntry || type === 'project') && !mongoose.Types.ObjectId.isValid(newProjectId))
    ) {
      const error = 'ObjectIds are not correctly formed';
      return res.status(400).send({ error });
    }

    const isForAuthUser = personId === req.body.requestor.requestorId;
    const isSameDayTimeEntry =
      moment().tz('America/Los_Angeles').format('YYYY-MM-DD') === newDateOfWork;
    const isSameDayAuthUserEdit = isForAuthUser && isSameDayTimeEntry;

    const session = await mongoose.startSession();
    session.startTransaction();
    const pendingEmailCollection = [];

    /**
     * possible side effects of time entry edit:
     * 1. note change => no side effect
     * 2. task change => task logged hours change (for both old and new task)
     * 3. project change => userprofile hoursByCategory change
     * 4. tangibility change => task logged hours change (for old or new tasks)
     *                          userporfile totalTangibleHrs/totalInTangibleHrs change
     *                          userprofile hoursByCategory change
     * 5. time change => task logged hours change
     *                   userprofile totalTangibleHrs/totalInTangibleHrs change
     *                   userprofile hoursByCategory change
     *                   add to userprofile timeEntryEditHistory
     *                   notifyEditByEmail
     * 6. dateOfWork change => add to userprofile timeEntryEditHistory
     *                         notifyEditByEmail
     */
    try {
      // Get initial timeEntry by timeEntryId
      const timeEntry = await TimeEntry.findById(timeEntryId);
      if (!timeEntry) {
        const error = `No valid records found for ${timeEntryId}`;
        return res.status(400).send({ error });
      }

      const {
        totalSeconds: initialTotalSeconds,
        isTangible: initialIsTangible,
        projectId: initialProjectIdObject,
        taskId: initialTaskIdObject,
        dateOfWork: initialDateOfWork,
      } = timeEntry;

      const initialProjectId = initialProjectIdObject ? initialProjectIdObject.toString() : null;
      const initialTaskId = initialTaskIdObject ? initialTaskIdObject.toString() : null;

      // Check if any of the fields have changed
      const projectChanged = initialProjectId !== newProjectId;
      const tangibilityChanged = initialIsTangible !== newIsTangible;
      const timeChanged = initialTotalSeconds !== newTotalSeconds;
      const dateOfWorkChanged = initialDateOfWork !== newDateOfWork;
      const isTimeModified = newTotalSeconds !== timeEntry.totalSeconds;
      const isDescriptionModified = newNotes !== timeEntry.notes;

      const canEditTimeEntryTime = await hasPermission(req.body.requestor, 'editTimeEntryTime');
      const canEditTimeEntryDescription = await hasPermission(
        req.body.requestor,
        'editTimeEntryDescription',
      );
      const canEditTimeEntryDate = await hasPermission(req.body.requestor, 'editTimeEntryDate');
      const canEditTimeEntryIsTangible = isForAuthUser
        ? await hasPermission(req.body.requestor, 'toggleTangibleTime')
        : await hasPermission(req.body.requestor, 'editTimeEntryToggleTangible');

      const isNotUsingAPermission =
        (!canEditTimeEntryTime && isTimeModified) || (!canEditTimeEntryDate && dateOfWorkChanged);

      // Time
      if (!isSameDayAuthUserEdit && isTimeModified && !canEditTimeEntryTime) {
        const error = `You do not have permission to edit the time entry time`;
        return res.status(403).send({ error });
      }

      // Description
      if (!isSameDayAuthUserEdit && isDescriptionModified && !canEditTimeEntryDescription) {
        const error = `You do not have permission to edit the time entry description`;
        return res.status(403).send({ error });
      }

      // Date
      if (dateOfWorkChanged && !canEditTimeEntryDate) {
        const error = `You do not have permission to edit the time entry date`;
        return res.status(403).send({ error });
      }

      // Tangible Time
      if (tangibilityChanged && !canEditTimeEntryIsTangible) {
        const error = `You do not have permission to edit the time entry isTangible`;
        return res.status(403).send({ error });
      }

      timeEntry.notes = newNotes;
      timeEntry.totalSeconds = newTotalSeconds;
      timeEntry.isTangible = newIsTangible;
      timeEntry.lastModifiedDateTime = moment().utc().toISOString();
      if (newProjectId) timeEntry.projectId = mongoose.Types.ObjectId(newProjectId);
      timeEntry.wbsId = newWbsId ? mongoose.Types.ObjectId(newWbsId) : null;
      timeEntry.taskId = newTaskId ? mongoose.Types.ObjectId(newTaskId) : null;
      timeEntry.dateOfWork = moment(newDateOfWork).format('YYYY-MM-DD');

      // now handle the side effects in task and userprofile if certain fields have changed
      const userprofile = await UserProfile.findById(personId);

      if (userprofile) {
        if (tangibilityChanged) {
          // if tangibility changed
          // tangiblity change usually only happens by itself via tangibility checkbox,
          // and it can't be changed by user directly (except for owner-like roles)
          // but here the other changes are also considered here for completeness
          // change from tangible to intangible
          if (initialIsTangible) {
            // subtract initial logged hours from old task (if not null)
            updateTaskLoggedHours(
              initialTaskId,
              initialTotalSeconds,
              null,
              null,
              userprofile,
              session,
              pendingEmailCollection,
            );
            // subtract initial logged hours from userprofile totalTangibleHrs and add new logged hours to userprofile totalIntangibleHrs
            updateUserprofileTangibleIntangibleHrs(
              -initialTotalSeconds,
              newTotalSeconds,
              userprofile,
            );

            // when changing from tangible to intangible, the original time needs to be removed from hoursByCategory
            await updateUserprofileCategoryHrs(
              initialProjectIdObject,
              initialTotalSeconds,
              null,
              null,
              userprofile,
            );
          } else {
            // from intangible to tangible
            updateTaskLoggedHours(
              null,
              null,
              newTaskId,
              newTotalSeconds,
              userprofile,
              session,
              pendingEmailCollection,
            );
            updateUserprofileTangibleIntangibleHrs(
              newTotalSeconds,
              -initialTotalSeconds,
              userprofile,
            );
            await updateUserprofileCategoryHrs(
              null,
              null,
              newProjectId,
              newTotalSeconds,
              userprofile,
            );
          }
          // make sure all hours are positive
          validateUserprofileHours(userprofile);
        } else if (initialIsTangible) {
          // if tangibility is not changed,
          // when timeentry remains tangible, this is usually when timeentry is edited by user in the same day or by owner-like roles

          // it doesn't matter if task is changed or not, just update taskLoggedHours and userprofile totalTangibleHours with new and old task ids
          updateTaskLoggedHours(
            initialTaskId,
            initialTotalSeconds,
            newTaskId,
            newTotalSeconds,
            userprofile,
            session,
            pendingEmailCollection,
          );
          // when project is also changed
          if (projectChanged || timeChanged) {
            await updateUserprofileCategoryHrs(
              initialProjectIdObject,
              initialTotalSeconds,
              newProjectId,
              newTotalSeconds,
              userprofile,
            );
            validateUserprofileHours(userprofile);
          }
          // if time or dateOfWork is changed
          if (timeChanged || dateOfWorkChanged) {
            const timeDiffInSeconds = newTotalSeconds - initialTotalSeconds;
            updateUserprofileTangibleIntangibleHrs(timeDiffInSeconds, 0, userprofile);
            notifyEditByEmail(
              userprofile,
              req.body.requestor.requestorId,
              initialTotalSeconds,
              newTotalSeconds,
              initialDateOfWork,
              newDateOfWork,
            );
            // Update edit history
            if (isNotUsingAPermission && isSameDayAuthUserEdit && isGeneralEntry) {
              addEditHistory(
                userprofile,
                initialTotalSeconds,
                newTotalSeconds,
                initialDateOfWork,
                newDateOfWork,
                pendingEmailCollection,
              );
            }
          }
        } else {
          // when timeentry is intangible before and after change,
          // just update timeEntry and the intangible hours in userprofile,
          // no need to update task/userprofile
          const timeDiffInSeconds = newTotalSeconds - initialTotalSeconds;
          updateUserprofileTangibleIntangibleHrs(0, timeDiffInSeconds, userprofile);
        }
      }
      await timeEntry.save({ session });
      if (userprofile) {
        await userprofile.save({ session, validateModifiedOnly: true });

        // since userprofile is updated, need to remove the cache so that the updated userprofile is fetched next time
        removeOutdatedUserprofileCache(userprofile._id.toString());
      }

      pendingEmailCollection.forEach((emailHandler) => emailHandler());
      await session.commitTransaction();
      return res.status(200).send(timeEntry);
    } catch (err) {
      await session.abortTransaction();
      logger.logException(err);
      return res.status(400).send({ error: err.toString() });
    } finally {
      session.endSession();
    }
  };

  /**
   * Delete a time entry
   */
  const deleteTimeEntry = async function (req, res) {
    if (!req.params.timeEntryId) {
      res.status(400).send({ error: 'Bad request' });
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const timeEntry = await TimeEntry.findById(req.params.timeEntryId);

      if (!timeEntry) {
        res.status(400).send({ message: 'No valid record found' });
        return;
      }
      const { personId, totalSeconds, dateOfWork, projectId, taskId, isTangible } = timeEntry;

      const isForAuthUser = personId
        ? personId.toString() === req.body.requestor.requestorId
        : false;
      const isSameDayTimeEntry =
        moment().tz('America/Los_Angeles').format('YYYY-MM-DD') === dateOfWork;
      const isSameDayAuthUserDelete = isForAuthUser && isSameDayTimeEntry;
      const hasDeleteTimeEntryPermission = await hasPermission(
        req.body.requestor,
        'deleteTimeEntry',
      );
      const canDelete = isSameDayAuthUserDelete || hasDeleteTimeEntryPermission;
      if (!canDelete) {
        res.status(403).send({ error: 'Unauthorized request' });
        return;
      }

      const userprofile = await UserProfile.findById(personId);

      if (userprofile) {
        // Revert this tangible timeEntry of related task's hoursLogged
        if (isTangible) {
          updateUserprofileTangibleIntangibleHrs(-totalSeconds, 0, userprofile);
          await updateUserprofileCategoryHrs(projectId, totalSeconds, null, null, userprofile);
          // if the time entry is related to a task, update the task hoursLogged
          if (taskId) {
            updateTaskLoggedHours(taskId, totalSeconds, null, null, userprofile, session);
          }
        } else {
          updateUserprofileTangibleIntangibleHrs(0, -totalSeconds, userprofile);
        }
      }

      await timeEntry.remove({ session });
      if (userprofile) {
        await userprofile.save({ session, validateModifiedOnly: true });

        // since userprofile is updated, need to remove the cache so that the updated userprofile is fetched next time
        removeOutdatedUserprofileCache(userprofile._id.toString());
      }

      await session.commitTransaction();
      res.status(200).send({ message: 'Successfully deleted' });
    } catch (error) {
      await session.abortTransaction();
      logger.logException(error);
      res.status(500).send({ error: error.toString() });
    } finally {
      session.endSession();
    }
  };

  /**
   * Get time entries for a specified period
   */
  const getTimeEntriesForSpecifiedPeriod = async function (req, res) {
    if (
      !req.params ||
      !req.params.fromdate ||
      !req.params.todate ||
      !req.params.userId ||
      !moment(req.params.fromdate).isValid() ||
      !moment(req.params.toDate).isValid()
    ) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }

    const fromdate = moment(req.params.fromdate).tz('America/Los_Angeles').format('YYYY-MM-DD');
    const todate = moment(req.params.todate).tz('America/Los_Angeles').format('YYYY-MM-DD');
    const { userId } = req.params;

    try {
      const timeEntries = await TimeEntry.find({
        entryType: { $in: ['default', 'person', null] },
        personId: userId,
        dateOfWork: { $gte: fromdate, $lte: todate },
        // include the time entries for the archived projects
      }).sort('-lastModifiedDateTime');

      const results = await Promise.all(
        timeEntries.map(async (timeEntry) => {
          timeEntry = { ...timeEntry.toObject() };
          const { projectId, taskId } = timeEntry;
          if (!taskId) await updateTaskIdInTimeEntry(projectId, timeEntry); // if no taskId, then it might be old time entry data that didn't separate projectId with taskId
          if (timeEntry.taskId) {
            const task = await Task.findById(timeEntry.taskId);
            if (task) {
              timeEntry.taskName = task.taskName;
            }
          }
          if (timeEntry.projectId) {
            const project = await Project.findById(timeEntry.projectId);
            if (project) {
              timeEntry.projectName = project.projectName;
            }
          }
          const hours = Math.floor(timeEntry.totalSeconds / 3600);
          const minutes = Math.floor((timeEntry.totalSeconds % 3600) / 60);
          Object.assign(timeEntry, { hours, minutes, totalSeconds: undefined });
          return timeEntry;
        }),
      );

      res.status(200).send(results);
    } catch (error) {
      res.status(400).send({ error });
    }
  };

  
  /**
   * Get total hours for a specified period for multiple users at once
   */
  const getUsersTotalHoursForSpecifiedPeriod = async function (req, res) {
    const { userIds, fromDate, toDate } = req.body;

    if (
      !fromDate ||
      !toDate ||
      !userIds ||
      !moment(fromDate).isValid() ||
      !moment(toDate).isValid()
    ) {
      return res.status(400).send({ error: 'Invalid request' });
    }

    const startDate = moment(fromDate).tz('America/Los_Angeles').format('YYYY-MM-DD');
    const endDate = moment(toDate).tz('America/Los_Angeles').format('YYYY-MM-DD');

    try {
      // g total hours
      const userHoursSummary = await TimeEntry.aggregate([
        {
          $match: {
            entryType: { $in: ['default', 'person', null] },
            personId: { $in:  userIds.map(id => mongoose.Types.ObjectId(id)) },
            dateOfWork: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$personId',
            totalHours: { $sum: { $divide: ['$totalSeconds', 3600] } }
          }
        }
      ]);
      const result = userHoursSummary.map(entry => ({
        userId: entry._id,
        totalHours: Math.round(entry.totalHours * 10) / 10 //round
      }));
      res.status(200).send(result);
    } catch (error) {
      logger.logException(error); // Log exception using consistent logger
      res.status(400).send({ error: 'Failed to calculate total hours', details: error.message });
    }
  };

  /**
   * Get time entries for a specified period for a list of users
   */
  const getTimeEntriesForUsersList = function (req, res) {
    const { users, fromDate, toDate } = req.body;

    TimeEntry.find(
      {
        entryType: { $in: ['default', null, 'person'] },
        personId: { $in: users },
        dateOfWork: { $gte: fromDate, $lte: toDate },
      },
      '-createdDateTime',
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
          record.projectId = element.projectId?._id || null;
          record.projectName = element.projectId?.projectName || null;
          record.projectCategory = element.projectId?.category.toLowerCase() || null;
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
        logger.logException(error);
        res.status(400).send(error);
      });
  };

  const getTimeEntriesForReports =async function (req, res) {
    const { users, fromDate, toDate } = req.body;
    const cacheKey = `timeEntry_${fromDate}_${toDate}`;
    const timeentryCache=cacheClosure();
    const cacheData=timeentryCache.hasCache(cacheKey)
    if(cacheData){
      const data = timeentryCache.getCache(cacheKey);
      return res.status(200).send(data);
    }
    try {
      const results = await TimeEntry.find(
        {
          personId: { $in: users },
          dateOfWork: { $gte: fromDate, $lte: toDate },
        },
        '-createdDateTime' // Exclude unnecessary fields
      )
        .lean() // Returns plain JavaScript objects, not Mongoose documents
        .populate({
          path: 'projectId',
          select: '_id projectName', // Only return necessary fields from the project
        })
        .exec(); // Executes the query
      const data = results.map(element => {
        const record = {
          _id: element._id,
          isTangible: element.isTangible,
          personId: element.personId,
          dateOfWork: element.dateOfWork,
          hours: formatSeconds(element.totalSeconds)[0],
          minutes: formatSeconds(element.totalSeconds)[1],
          projectId: element.projectId?._id || '',
          projectName: element.projectId?.projectName || '',
        };
        return record;
      });
      timeentryCache.setCache(cacheKey,data);
      return res.status(200).send(data);
    } catch (error) {
      res.status(400).send(error);
    }
  };

  const getTimeEntriesForProjectReports = function (req, res) {
    const { users, fromDate, toDate } = req.body;

    // Fetch only necessary fields and avoid bringing the entire document
    TimeEntry.find(
      {
        personId: { $in: users },
        dateOfWork: { $gte: fromDate, $lte: toDate },
      },
      'totalSeconds isTangible dateOfWork projectId',
    )
      .populate('projectId', 'projectName _id')
      .lean() // lean() for better performance as we don't need Mongoose document methods
      .then((results) => {
        const data = results.map((element) => {
          const record = {
            isTangible: element.isTangible,
            dateOfWork: element.dateOfWork,
            projectId: element.projectId ? element.projectId._id : '',
            projectName: element.projectId ? element.projectId.projectName : '',
          };

          // Convert totalSeconds to hours and minutes
          [record.hours, record.minutes] = formatSeconds(element.totalSeconds);

          return record;
        });

        res.status(200).send(data);
      })
      .catch((error) => {
        res.status(400).send({ message: 'Error fetching time entries for project reports', error });
      });
  };

  const getTimeEntriesForPeopleReports = async function (req, res) {
    try {
      const { users, fromDate, toDate } = req.body;

      const results = await TimeEntry.find(
        {
          personId: { $in: users },
          dateOfWork: { $gte: fromDate, $lte: toDate },
        },
        'personId totalSeconds isTangible dateOfWork',
      ).lean(); // Use lean() for better performance

      const data = results
        .map((entry) => {
          const [hours, minutes] = formatSeconds(entry.totalSeconds);
          return {
            personId: entry.personId,
            hours,
            minutes,
            isTangible: entry.isTangible,
            dateOfWork: entry.dateOfWork,
          };
        })
        .filter(Boolean);

      res.status(200).send(data);
    } catch (error) {
      res.status(400).send({ message: 'Error fetching time entries for people reports', error });
    }
  };

  /**
   * Get time entries for a specified project
   */
  const getTimeEntriesForSpecifiedProject = function (req, res) {
    if (!req.params || !req.params.fromDate || !req.params.toDate || !req.params.projectId) {
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
        isActive: { $ne: false },
      },
      '-createdDateTime -lastModifiedDateTime',
    )
      .populate('personId', 'firstName lastName  isActive')
      .sort({ dateOfWork: -1 })
      .then((results) => {
        res.status(200).send(results);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  /**
   * Get lost time entries for a list of users
   */
  const getLostTimeEntriesForUserList = function (req, res) {
    const { users, fromDate, toDate } = req.body;

    TimeEntry.find(
      {
        entryType: 'person',
        personId: { $in: users },
        dateOfWork: { $gte: fromDate, $lte: toDate },
        isActive: { $ne: false },
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
          record.firstName = element.personId ? element.personId.firstName : '';
          record.lastName = element.personId ? element.personId.lastName : '';
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

  /**
   * Get lost time entries for a list of projects
   */
  const getLostTimeEntriesForProjectList = function (req, res) {
    const { projects, fromDate, toDate } = req.body;

    TimeEntry.find(
      {
        entryType: 'project',
        projectId: { $in: projects },
        dateOfWork: { $gte: fromDate, $lte: toDate },
        isActive: { $ne: false },
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
          record.projectName = element.projectId ? element.projectId.projectName : '';
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

  /**
   * Get lost time entries for a list of teams
   */
  const getLostTimeEntriesForTeamList = function (req, res) {
    const { teams, fromDate, toDate } = req.body;
    const lostteamentryCache=cacheClosure()
    const cacheKey = `LostTeamEntry_${fromDate}_${toDate}`;
    const cacheData=lostteamentryCache.getCache(cacheKey)
    if(cacheData){
      return res.status(200).send(cacheData)
    }
    TimeEntry.find(
      {
        entryType: 'team',
        teamId: { $in: teams },
        dateOfWork: { $gte: fromDate, $lte: toDate },
        isActive: { $ne: false },
      },
      ' -createdDateTime',
    ).lean()
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
          record.teamName = element.teamId ? element.teamId.teamName : '';
          record.dateOfWork = element.dateOfWork;
          record.entryType = element.entryType;
          [record.hours, record.minutes] = formatSeconds(element.totalSeconds);
          data.push(record);
        });
        lostteamentryCache.setCache(cacheKey,data);
        return res.status(200).send(data);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  /**
   * back up the hoursByCategory value in a newly created field backupHoursByCategory if this user hasn't been backed up before
   * for testing purpose in the recalculation
   */
  const backupHoursByCategoryAllUsers = async function (req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const userprofiles = await UserProfile.find({}, '_id hoursByCategory').lean();
      const backupPromises = userprofiles.map(async (userprofile) => {
        const { hoursByCategory: oldHoursByCategory, _id: personId } = userprofile;

        await UserProfile.findOneAndUpdate(
          { _id: personId, backupHoursByCategory: { $exists: false } },
          { $set: { backupHoursByCategory: oldHoursByCategory } },
          { strict: false },
        );
      });

      await Promise.all(backupPromises);

      await session.commitTransaction();
      return res.status(200).send({
        message: 'backup of hoursByCategory for all users successfully',
      });
    } catch (err) {
      await session.abortTransaction();
      logger.logException(err);
      return res.status(500).send({ error: err.toString() });
    } finally {
      session.endSession();
    }
  };

  /**
   * back up the totalIntangible value in a newly created field backupHoursByCategory if this user hasn't been backed up before
   * for testing purpose in the recalculation
   */
  const backupIntangibleHrsAllUsers = async function (req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const userprofiles = await UserProfile.find({}, '_id totalIntangibleHrs').lean();
      const backupPromises = userprofiles.map(async (userprofile) => {
        const { totalIntangibleHrs: oldTotalIntangibleHrs, _id: personId } = userprofile;

        await UserProfile.findOneAndUpdate(
          { _id: personId, backupTotalIntangibleHrs: { $exists: false } },
          { $set: { backupTotalIntangibleHrs: oldTotalIntangibleHrs } },
          { strict: false },
        );
      });

      await Promise.all(backupPromises);

      await session.commitTransaction();
      return res.status(200).send({
        message: 'backup of totalIntangibleHrs for all users successfully',
      });
    } catch (err) {
      await session.abortTransaction();
      logger.logException(err);
      return res.status(500).send({ error: err.toString() });
    } finally {
      session.endSession();
    }
  };

  /**
   * helper function for calculating a user's hoursByCategory from TimeEntry and Projects
   */
  const tangibleCalculationHelper = async (userId) => {
    const newCalculatedCategoryHrs = {
      housing: 0,
      food: 0,
      education: 0,
      society: 0,
      energy: 0,
      economics: 0,
      stewardship: 0,
      unassigned: 0,
    };

    const timeEntries = await TimeEntry.find({ personId: userId });
    const updateCategoryPromises = timeEntries.map(async (timeEntry) => {
      const { projectId, totalSeconds, isTangible } = timeEntry;
      const totalHours = Number(totalSeconds / 3600);
      const project = await Project.findById(projectId);

      if (isTangible) {
        if (project) {
          const { category } = project;
          if (category && category.toLowerCase() in newCalculatedCategoryHrs) {
            newCalculatedCategoryHrs[category.toLowerCase()] += totalHours;
          } else {
            newCalculatedCategoryHrs.unassigned += totalHours;
          }
        } else {
          newCalculatedCategoryHrs.unassigned += totalHours;
        }
      }
    });
    await Promise.all(updateCategoryPromises);

    return newCalculatedCategoryHrs;
  };

  /**
   * helper function for calculating a user's totalIntangibleHrs from TimeEntry and Projects
   */
  const intangibleCalculationHelper = async (userId) => {
    let newTotalIntangibleHrs = 0;

    const timeEntries = await TimeEntry.find({ personId: userId });
    const updateIntangibleHrsPromises = timeEntries.map(async (timeEntry) => {
      const { totalSeconds, isTangible } = timeEntry;
      const totalHours = Number(totalSeconds / 3600);
      if (!isTangible) {
        newTotalIntangibleHrs += totalHours;
      }
    });
    await Promise.all(updateIntangibleHrsPromises);

    return newTotalIntangibleHrs;
  };

  const recalculationTaskQueue = [];

  /**
   * recalculate the hoursByCategory for all users and update the field
   */
  const recalculateHoursByCategoryAllUsers = async function (taskId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userprofiles = await UserProfile.find({}, '_id').lean();

      const recalculationPromises = userprofiles.map(async (userprofile) => {
        const { _id: userId } = userprofile;
        const newCalculatedCategoryHrs = await tangibleCalculationHelper(userId);
        await UserProfile.findByIdAndUpdate(userId, { hoursByCategory: newCalculatedCategoryHrs });
      });
      await Promise.all(recalculationPromises);

      await session.commitTransaction();

      const recalculationTask = recalculationTaskQueue.find((task) => task.taskId === taskId);
      if (recalculationTask) {
        recalculationTask.status = 'Completed';
        recalculationTask.completionTime = new Date().toISOString();
      }
    } catch (err) {
      await session.abortTransaction();
      const recalculationTask = recalculationTaskQueue.find((task) => task.taskId === taskId);
      if (recalculationTask) {
        recalculationTask.status = 'Failed';
        recalculationTask.completionTime = new Date().toISOString();
      }

      logger.logException(err);
    } finally {
      session.endSession();
    }
  };

  const startRecalculation = async function (req, res) {
    const taskId = uuidv4();
    recalculationTaskQueue.push({
      taskId,
      status: 'In progress',
      startTime: new Date().toISOString(),
      completionTime: null,
    });
    if (recalculationTaskQueue.length > 10) {
      recalculationTaskQueue.shift();
    }

    res.status(200).send({
      message: 'The recalculation task started in the background',
      taskId,
    });

    setTimeout(() => recalculateHoursByCategoryAllUsers(taskId), 0);
  };

  const checkRecalculationStatus = async function (req, res) {
    const { taskId } = req.params;
    const recalculationTask = recalculationTaskQueue.find((task) => task.taskId === taskId);
    if (recalculationTask) {
      res.status(200).send({
        status: recalculationTask.status,
        startTime: recalculationTask.startTime,
        completionTime: recalculationTask.completionTime,
      });
    } else {
      res.status(404).send({ message: 'Task not found' });
    }
  };

  /**
   * recalculate the totalIntangibleHrs for all users and update the field
   */
  const recalculateIntangibleHrsAllUsers = async function (req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userprofiles = await UserProfile.find({}, '_id').lean();

      const recalculationPromises = userprofiles.map(async (userprofile) => {
        const { _id: userId } = userprofile;
        const newCalculatedIntangibleHrs = await intangibleCalculationHelper(userId);
        await UserProfile.findByIdAndUpdate(userId, {
          totalIntangibleHrs: newCalculatedIntangibleHrs,
        });
      });
      await Promise.all(recalculationPromises);

      await session.commitTransaction();
      return res.status(200).send({
        message: 'finished the recalculation for totalIntangibleHrs for all users',
      });
    } catch (err) {
      await session.abortTransaction();
      logger.logException(err);
      return res.status(500).send({ error: err.toString() });
    } finally {
      session.endSession();
    }
  };

  return {
    postTimeEntry,
    editTimeEntry,
    deleteTimeEntry,
    getTimeEntriesForSpecifiedPeriod,
    getUsersTotalHoursForSpecifiedPeriod,
    getTimeEntriesForUsersList,
    getTimeEntriesForSpecifiedProject,
    getLostTimeEntriesForUserList,
    getLostTimeEntriesForProjectList,
    getLostTimeEntriesForTeamList,
    backupHoursByCategoryAllUsers,
    backupIntangibleHrsAllUsers,
    recalculateIntangibleHrsAllUsers,
    getTimeEntriesForReports,
    getTimeEntriesForProjectReports,
    getTimeEntriesForPeopleReports,
    startRecalculation,
    checkRecalculationStatus,
  };
};

module.exports = timeEntrycontroller;
