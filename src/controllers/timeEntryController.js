const moment = require('moment-timezone');
const mongoose = require('mongoose');
const logger = require('../startup/logger');
const { getInfringementEmailBody } = require('../helpers/userHelper')();
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
  // console.log("1. hoursByCategory: ", userprofile.hoursByCategory);
  if (fromProjectId) {
    // console.log("remove part executed");
    const fromProject = await Project.findById(fromProjectId);
    const hoursToBeRemoved = Number((secondsToBeRemoved / 3600).toFixed(2));
    if (fromProject.category.toLowerCase() in userprofile.hoursByCategory) {
      userprofile.hoursByCategory[fromProject.category.toLowerCase()] -= hoursToBeRemoved;
    } else {
      userprofile.hoursByCategory.unassigned -= hoursToBeRemoved;
    }
    // console.log("2. hoursByCategory: ", userprofile.hoursByCategory)
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

  if (totalRecentEdits >= 3) {
    userprofile.infringements.push({
      date: moment().tz('America/Los_Angeles'),
      description: `${totalRecentEdits} time entry edits in the last calendar year`,
    });

    const infringementNotificationEmail = `
    <p>
      ${userprofile.firstName} ${userprofile.lastName} (${userprofile.email}) was issued a blue square for editing their time entries ${totalRecentEdits} times
      within the last calendar year.
    </p>
    <p>
      This is the ${totalRecentEdits}th edit within the past 365 days.
    </p>
    `;

    const emailInfringement = {
      date: moment().tz('America/Los_Angeles').format('MMMM-DD-YY'),
      description: `You edited your time entries ${totalRecentEdits} times within the last 365 days, exceeding the limit of 4 times per year you can edit them without penalty.`,
    };

    pendingEmailCollection.push(
      emailSender.bind(
        null,
        'onecommunityglobal@gmail.com',
        `${userprofile.firstName} ${userprofile.lastName} was issued a blue square for for editing a time entry ${totalRecentEdits} times`,
        infringementNotificationEmail,
      ),
      emailSender.bind(
        null,
        userprofile.email,
        "You've been issued a blue square for editing your time entry",
        getInfringementEmailBody(
          userprofile.firstName,
          userprofile.lastName,
          emailInfringement,
          userprofile.infringements.length,
        ),
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

      // Replace the isFirstTimelog checking logic from the frontend to the backend
      // Update the user start date to current date if this is the first time entry (Weekly blue square assignment related)
      const isFirstTimeEntry = await checkIsUserFirstTimeEntry(timeEntry.personId);
      if (isFirstTimeEntry) {
        userprofile.isFirstTimelog = false;
        userprofile.startDate = now;
      }

      await timeEntry.save({ session });
      await userprofile.save({ session });

      // since userprofile is updated, need to remove the cache so that the updated userprofile is fetched next time
      removeOutdatedUserprofileCache(userprofile._id.toString());

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
    const isRequestorAdminLikeRole = ['Owner', 'Administrator'].includes(req.body.requestor.role);
    const hasEditTimeEntryPermission = await hasPermission(req.body.requestor, 'editTimeEntry');

    const canEdit = isSameDayAuthUserEdit || isRequestorAdminLikeRole || hasEditTimeEntryPermission;

    if (!canEdit) {
      const error = 'Unauthorized request';
      return res.status(403).send({ error });
    }

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

      const initialProjectId = initialProjectIdObject.toString();
      const initialTaskId = initialTaskIdObject ? initialTaskIdObject.toString() : null;

      // Check if any of the fields have changed
      const projectChanged = initialProjectId !== newProjectId;
      const tangibilityChanged = initialIsTangible !== newIsTangible;
      const timeChanged = initialTotalSeconds !== newTotalSeconds;
      const dateOfWorkChanged = initialDateOfWork !== newDateOfWork;
      timeEntry.notes = newNotes;
      timeEntry.totalSeconds = newTotalSeconds;
      timeEntry.isTangible = newIsTangible;
      timeEntry.lastModifiedDateTime = moment().utc().toISOString();
      timeEntry.projectId = mongoose.Types.ObjectId(newProjectId);
      timeEntry.wbsId = newWbsId ? mongoose.Types.ObjectId(newWbsId) : null;
      timeEntry.taskId = newTaskId ? mongoose.Types.ObjectId(newTaskId) : null;
      timeEntry.dateOfWork = moment(newDateOfWork).format('YYYY-MM-DD');

      // now handle the side effects in task and userprofile if certain fields have changed
      const userprofile = await UserProfile.findById(personId);

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

          // Original Comment: if project is changed, update userprofile hoursByCategory
          // Updated Comment: whether project is changed or not, the original tangible time needs to be removed from hoursByCategory
          // if (projectChanged) {
          await updateUserprofileCategoryHrs(
            initialProjectIdObject,
            initialTotalSeconds,
            null,
            null,
            userprofile,
          );
          // }
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
            // initialTotalSeconds,
            // -newTotalSeconds,
            // userprofile,
            newTotalSeconds,
            -initialTotalSeconds,
            userprofile,
          );
          // if (projectChanged) {
          await updateUserprofileCategoryHrs(
            null,
            null,
            newProjectId,
            newTotalSeconds,
            userprofile,
          );
          // }
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
        console.log('5. hoursByCategory: ', userprofile.hoursByCategory);
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
          if (
            !isRequestorAdminLikeRole &&
            !hasEditTimeEntryPermission &&
            isSameDayAuthUserEdit &&
            isGeneralEntry
          ) {
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
      await timeEntry.save({ session });
      // console.log("right before save session for userprofile");
      await userprofile.save({ session });

      // since userprofile is updated, need to remove the cache so that the updated userprofile is fetched next time
      removeOutdatedUserprofileCache(userprofile._id.toString());

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

      const isForAuthUser = personId.toString() === req.body.requestor.requestorId;
      const isSameDayTimeEntry =
        moment().tz('America/Los_Angeles').format('YYYY-MM-DD') === dateOfWork;
      const isSameDayAuthUserDelete = isForAuthUser && isSameDayTimeEntry;
      const isRequestorAdminLikeRole = ['Owner', 'Administrator'].includes(req.body.requestor.role);
      const hasDeleteTimeEntryPermission = await hasPermission(
        req.body.requestor,
        'deleteTimeEntry',
      );
      const canDelete =
        isSameDayAuthUserDelete || isRequestorAdminLikeRole || hasDeleteTimeEntryPermission;
      if (!canDelete) {
        res.status(403).send({ error: 'Unauthorized request' });
        return;
      }

      const userprofile = await UserProfile.findById(personId);

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

      // console.log("deleteTimeEntry: right before save session for userprofile");
      await userprofile.save({ session });
      await timeEntry.remove({ session });

      // since userprofile is updated, need to remove the cache so that the updated userprofile is fetched next time
      removeOutdatedUserprofileCache(userprofile._id.toString());

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
        entryType: { $in: ['default', null] },
        personId: userId,
        dateOfWork: { $gte: fromdate, $lte: todate },
        isActive: { $ne: false },
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

  const getTimeEntriesForReports = function (req, res) {
    const { users, fromDate, toDate } = req.body;

    TimeEntry.find(
      {
        personId: { $in: users },
        dateOfWork: { $gte: fromDate, $lte: toDate },
      },
      ' -createdDateTime',
    )
      .populate('projectId')

      .then((results) => {
        const data = [];

        results.forEach((element) => {
          const record = {};
          record._id = element._id;
          record.isTangible = element.isTangible;
          record.personId = element.personId._id;
          record.dateOfWork = element.dateOfWork;
          [record.hours, record.minutes] = formatSeconds(element.totalSeconds);
          record.projectId = element.projectId ? element.projectId._id : '';
          record.projectName = element.projectId ? element.projectId.projectName : '';
          data.push(record);
        });

        res.status(200).send(data);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
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
      .populate('userId')
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

    TimeEntry.find(
      {
        entryType: 'team',
        teamId: { $in: teams },
        dateOfWork: { $gte: fromDate, $lte: toDate },
        isActive: { $ne: false },
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
          record.teamName = element.teamId ? element.teamId.teamName : '';
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

  //
  const backupHoursByCategoryAllUsers = async function (req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const userprofiles = await UserProfile.find({});
      const backupPromises = userprofiles.map(async (userprofile) => {
        const { hoursByCategory: oldHoursByCategory, _id: personId } = userprofile;
        // backup the old hoursByCategory data in a newly created field
        await UserProfile.findByIdAndUpdate(
          personId,
          { backupHoursByCategory: oldHoursByCategory },
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

  const calculationHelper = async (userId) => {
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
      const { projectId } = timeEntry;
      const project = await Project.findById(projectId);
      if (project) {
        const { category } = project;
        const { totalSeconds } = timeEntry;
        const totalHours = Number(totalSeconds / 3600);
        const { isTangible } = timeEntry;

        if (isTangible) {
          if (category.toLowerCase() in newCalculatedCategoryHrs) {
            newCalculatedCategoryHrs[category.toLowerCase()] += totalHours;
          } else {
            newCalculatedCategoryHrs.unassigned += totalHours;
          }
        }
      }
    });
    await Promise.all(updateCategoryPromises);

    return newCalculatedCategoryHrs;
  };

  //
  const recalculateHoursByCategoryAllUsers = async function (req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userprofiles = await UserProfile.find({});

      const recalculationPromises = userprofiles.map(async (userprofile) => {
        const { _id: userId } = userprofile;

        const newCalculatedCategoryHrs = await calculationHelper(userId);

        const { hoursByCategory: oldHoursByCategory } = userprofile;

        // store the old hoursByCategory data in a new field backupHoursByCategory
        await UserProfile.findOneAndUpdate(
          { _id: userId, backupHoursByCategory: { $exists: false } },
          { $set: { backupHoursByCategory: oldHoursByCategory } },
          { strict: false },
        );

        // update the hoursByCategory field
        await UserProfile.findByIdAndUpdate(userId, { hoursByCategory: newCalculatedCategoryHrs });
      });

      await Promise.all(recalculationPromises);

      await session.commitTransaction();
      return res.status(200).send({
        message: 'finished the recalculation for hoursByCategory for all users',
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
    getTimeEntriesForUsersList,
    getTimeEntriesForSpecifiedProject,
    getLostTimeEntriesForUserList,
    getLostTimeEntriesForProjectList,
    getLostTimeEntriesForTeamList,
    backupHoursByCategoryAllUsers,
    recalculateHoursByCategoryAllUsers,
    getTimeEntriesForReports,
  };
};

module.exports = timeEntrycontroller;
