/* eslint-disable no-nested-ternary */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */
/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
/* eslint-disable no-console */
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');
const moment_ = require('moment');
const jwt = require('jsonwebtoken');
const userHelper = require('../helpers/userHelper')();
const TimeEntry = require('../models/timeentry');
const logger = require('../startup/logger');
const Badge = require('../models/badge');
// eslint-disable-next-line no-unused-vars
const yearMonthDayDateValidator = require('../utilities/yearMonthDayDateValidator');
const cacheClosure = require('../utilities/nodeCache');
const followUp = require('../models/followUp');
const HGNFormResponses = require('../models/hgnFormResponse');
const userService = require('../services/userService');
const { hasPermission, canRequestorUpdateUser } = require('../utilities/permissions');
const helper = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const emailSender = require('../utilities/emailSender');
const objectUtils = require('../utilities/objectUtils');
const config = require('../config');
// eslint-disable-next-line import/order
const { PROTECTED_EMAIL_ACCOUNT } = require('../utilities/constants');

const authorizedUserSara = `nathaliaowner@gmail.com`; // To test this code please include your email here
const authorizedUserJae = `jae@onecommunityglobal.org`;

// Import reports controller to access cache invalidation function
const reportsController = require('./reportsController')();

// Constants for magic numbers
const SEARCH_RESULT_LIMIT = 10;
const MAX_WEEKS_FOR_CACHE_INVALIDATION = 3;
const MAX_WEEKS_FOR_CACHE_CLEAR = 10;
const { COMPANY_TZ } = require('../constants/company');
const {
  InactiveReason,
  UserStatusOperations,
  LifecycleStatus,
} = require('../constants/userProfile');

async function ValidatePassword(req, res) {
  const { userId } = req.params;
  const { requestor } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).send({
      error: 'Bad Request',
    });
    return;
  }

  // Verify correct params in body
  if (!req.body.newpassword || !req.body.confirmnewpassword) {
    res.status(400).send({
      error: 'One of more required fields are missing',
    });
    return;
  }

  const canUpdate = await hasPermission(req.body.requestor, 'updatePassword');

  // Verify request is authorized by self or adminsitrator
  if (userId !== requestor.requestorId && !canUpdate) {
    res.status(403).send({
      error: "You are unauthorized to update this user's password",
    });
    return;
  }

  // Verify request is authorized by self or adminsitrator
  if (userId === requestor.requestorId && !canUpdate) {
    res.status(403).send({
      error: "You are unauthorized to update this user's password",
    });
    return;
  }

  // Verify new and confirm new password are correct
  if (req.body.newpassword !== req.body.confirmnewpassword) {
    res.status(400).send({
      error: 'New and confirm new passwords are not same',
    });
  }
}

const sendEmailUponProtectedAccountUpdate = ({
  requestorEmail,
  requestorFullName,
  targetEmail,
  action,
  logId,
}) => {
  const updatedDate = moment_().format('MMM-DD-YY');
  const subject = 'One Community: Protected Account Has Been Updated';
  const emailBody = `<p> Hi Admin! </p>

          <p><strong>Protected Account ${targetEmail} is updated by ${requestorEmail} </strong></p>

          <p><strong>Here are the details for the new ${targetEmail} account:</strong></p>
          <ul>
            <li><strong>Updated Date:</strong> ${updatedDate}</li>
            <li><strong>Action:</strong> ${action}</li>
          </ul>

          <p><strong>Who updated this new account?</strong></p>
          <ul>
            <li><strong>Name:</strong> ${requestorFullName}</li>
            <li><strong>Email:</strong> <a href="mailto:${requestorEmail}">${requestorEmail}</a></li>
          </ul>

          <p>If you have any questions or notice any issues,
          please investigate further by searching log <b>transaction ID ${logId} in the Sentry </b>.</p>

          <p>Thank you for your attention to this matter.</p>

          <p>Sincerely,</p>
          <p>The HGN (and One Community)</p>`;
  emailSender(targetEmail, subject, emailBody, null, null);
};

const auditIfProtectedAccountUpdated = async ({
  requestorId,
  updatedRecordEmail,
  originalRecord,
  updatedRecord,
  updateDiffPaths,
  actionPerformed,
}) => {
  if (PROTECTED_EMAIL_ACCOUNT.includes(updatedRecordEmail)) {
    const requestorProfile = await userService.getUserFullNameAndEmailById(requestorId);
    const requestorFullName = requestorProfile
      ? requestorProfile.firstName.concat(' ', requestorProfile.lastName)
      : 'N/A';
    // remove sensitive data from the original and updated records
    let extraData = null;
    const updateObject = updatedRecord?.toObject();
    if (updateDiffPaths) {
      const { originalObj, updatedObj } = objectUtils.returnObjectDifference(
        originalRecord,
        updateObject,
        updateDiffPaths,
      );
      const originalObjectString = originalRecord ? JSON.stringify(originalObj) : null;
      const updatedObjectString = updatedRecord ? JSON.stringify(updatedObj) : null;
      extraData = {
        originalObjectString,
        updatedObjectString,
      };
    }
    const logId = logger.logInfo(
      `Protected email account updated. Target: ${updatedRecordEmail}
      Requestor: ${requestorProfile ? requestorFullName : requestorId}`,
      extraData,
    );

    sendEmailUponProtectedAccountUpdate({
      requestorEmail: requestorProfile?.email,
      requestorFullName,
      targetEmail: updatedRecordEmail,
      action: actionPerformed,
      logId,
    });
  }
};

const PRReviewInsights = require('../models/prAnalytics/prReviewsInsights');

// eslint-disable-next-line max-lines-per-function
const createControllerMethods = function (UserProfile, Project, cache) {
  const forbidden = function (res, message) {
    res.status(403).send(message);
  };

  const checkPermission = async function (req, permission) {
    return helper.hasPermission(req.body.requestor, permission);
  };

  // Helper functions for postUserProfile
  const validateUserEmail = async (email) => {
    const userByEmail = await UserProfile.findOne({
      email: {
        $regex: escapeRegex(email),
        $options: 'i',
      },
    });
    return userByEmail;
  };

  const validateBetaCredentials = async (email, password) => {
    const url = 'https://hgn-rest-beta.azurewebsites.net/api/';
    const response = await fetch(`${url}login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    return response.ok;
  };

  const createUserFromRequest = (req) => {
    const up = new UserProfile();
    up.password = req.body.password;
    up.role = req.body.role;
    up.firstName = req.body.firstName;
    up.lastName = req.body.lastName;
    up.jobTitle = req.body.jobTitle;
    up.phoneNumber = req.body.phoneNumber;
    up.bio = req.body.bio;
    up.weeklycommittedHours = req.body.weeklycommittedHours;
    up.weeklycommittedHoursHistory = [
      {
        hours: up.weeklycommittedHours,
        dateChanged: Date.now(),
      },
    ];
    up.personalLinks = req.body.personalLinks;
    up.adminLinks = req.body.adminLinks;
    up.teams = Array.from(new Set(req.body.teams));
    up.projects = Array.from(new Set(req.body.projects));
    up.teamCode = req.body.teamCode;
    up.createdDate = req.body.createdDate;
    up.startDate = req.body.startDate ? req.body.startDate : req.body.createdDate;
    up.email = req.body.email;
    up.weeklySummaries = req.body.weeklySummaries || [{ summary: '' }];
    up.weeklySummariesCount = req.body.weeklySummariesCount || 0;
    up.weeklySummaryOption = req.body.weeklySummaryOption;
    up.mediaUrl = req.body.mediaUrl || '';
    up.collaborationPreference = req.body.collaborationPreference || '';
    up.timeZone = req.body.timeZone || 'America/Los_Angeles';
    up.location = req.body.location;
    up.permissions = req.body.permissions;
    up.bioPosted = req.body.bioPosted || 'default';
    up.isFirstTimelog = true;
    up.actualEmail = req.body.actualEmail;
    up.isVisible = !['Mentor'].includes(req.body.role);
    return up;
  };

  const sendNewRoleEmail = (up, requestor) => {
    const condition =
      process.env.dbName === 'hgnData_dev'
        ? up.role === 'Owner'
        : up.role === 'Owner' || up.role === 'Administrator';
    if (condition) {
      const subject = `${process.env.dbName !== 'hgnData_dev' ? '*Main Site* -' : ''}New ${up.role} Role Created`;
      const emailBody = `<p> Hi Admin! </p>

          <p><strong>New Account Details</strong></p>
          <p>This email is to inform you that <strong>${up.firstName} ${up.lastName}</strong> has been created as a new ${up.role} account on the Highest Good Network application.</p>

          <p><strong>Here are the details for the new ${up.role} account:</strong></p>
          <ul>
          <li><strong>Name:</strong> ${up.firstName} ${up.lastName}</li>
          <li><strong>Email:</strong> <a href="mailto:${up.email}">${up.email}</a></li>
          </ul>

          <p><strong>Who created this new account?</strong></p>
          <ul>
          <li><strong>Name:</strong> ${requestor.firstName} ${requestor.lastName}</li>
          <li><strong>Email:</strong> <a href="mailto:${requestor.email}">${requestor.email}</a></li>
          </ul>

          <p>If you have any questions or notice any issues, please investigate further.</p>

          <p>Thank you for your attention to this matter.</p>

          <p>Sincerely,</p>
          <p>The HGN A.I. (and One Community)</p>`;

      emailSender('onecommunityglobal@gmail.com', subject, emailBody, null, null);
    }
  };

  const updateCacheForNewUser = (up) => {
    if (cache.getCache('allusers')) {
      const userCache = {
        permissions: up.permissions,
        isActive: true,
        weeklycommittedHours: up.weeklycommittedHours,
        createdDate: up.createdDate.toISOString(),
        startDate: up.startDate.toISOString(),
        _id: up._id,
        role: up.role,
        firstName: up.firstName,
        lastName: up.lastName,
        email: up.email,
      };
      const allUserCache = JSON.parse(cache.getCache('allusers'));
      allUserCache.push(userCache);
      cache.setCache('allusers', JSON.stringify(allUserCache));
    }
  };

  // Helper functions for putUserProfile
  const updateTeamCode = (req, record) => {
    if (!req.body.teamCode) return true;

    const canEditTeamCode =
      req.body.requestor.role === 'Owner' ||
      req.body.requestor.role === 'Administrator' ||
      req.body.requestor.permissions?.frontPermissions.includes('editTeamCode');

    if (!canEditTeamCode && record.teamCode !== req.body.teamCode) {
      return false;
    }
    if (req.body.teamCode !== record.teamCode) {
      cache.removeCache('teamCodes');
    }
    record.teamCode = req.body.teamCode;
    return true;
  };

  const updateCommonFields = (req, record) => {
    const commonFields = [
      'jobTitle',
      'emailPubliclyAccessible',
      'phoneNumberPubliclyAccessible',
      'profilePic',
      'firstName',
      'lastName',
      'phoneNumber',
      'bio',
      'personalLinks',
      'location',
      'privacySettings',
      'weeklySummaries',
      'weeklySummariesCount',
      'mediaUrl',
      'timeZone',
      'hoursByCategory',
      'totalTangibleHrs',
      'totalIntangibleHrs',
      'isFirstTimelog',
      'isVisible',
      'bioPosted',
      'infringementCount',
      'isStartDateManuallyModified',
    ];

    commonFields.forEach((fieldName) => {
      if (req.body[fieldName] !== undefined) {
        record[fieldName] = req.body[fieldName];
      }
    });
    record.lastModifiedDate = Date.now();
  };

  const updateSummaryFields = async (req, record) => {
    if (await hasPermission(req.body.requestor, 'updateSummaryRequirements')) {
      const summaryFields = ['weeklySummaryNotReq', 'weeklySummaryOption'];
      summaryFields.forEach((fieldName) => {
        if (req.body[fieldName] !== undefined) {
          record[fieldName] = req.body[fieldName];
        }
      });
    }
  };

  const updateProjects = async (req, record) => {
    if (!Array.isArray(req.body.projects)) return;

    const newProjects = req.body.projects
      .map((project) => {
        if (!project) return null;
        const id = project._id || project.projectId || project;
        return id ? id.toString() : null;
      })
      .filter(Boolean);

    const oldProjects = (record.projects || []).map((id) => id.toString());

    const projectsChanged =
      oldProjects.length !== newProjects.length ||
      !oldProjects.every((id) => newProjects.includes(id)) ||
      !newProjects.every((id) => oldProjects.includes(id));

    if (projectsChanged) {
      record.projects = newProjects.map((id) => mongoose.Types.ObjectId(id));

      const addedProjects = newProjects.filter((id) => !oldProjects.includes(id));
      const removedProjects = oldProjects.filter((id) => !newProjects.includes(id));
      const changedProjectIds = [...addedProjects, ...removedProjects].map((id) =>
        mongoose.Types.ObjectId(id),
      );

      if (changedProjectIds.length > 0) {
        const now = new Date();
        Project.updateMany(
          { _id: { $in: changedProjectIds } },
          { $set: { membersModifiedDatetime: now } },
        )
          .exec()
          .catch((error) => {
            console.error('Error updating project membersModifiedDatetime:', error);
          });
      }
    }
  };

  const updateWeeklyCommittedHours = (req, record) => {
    if (
      req.body.weeklycommittedHours !== undefined &&
      record.weeklycommittedHours !== req.body.weeklycommittedHours
    ) {
      record.weeklycommittedHours = req.body.weeklycommittedHours;

      const lasti = record.weeklycommittedHoursHistory.length - 1;
      const lastChangeDate = moment(record.weeklycommittedHoursHistory[lasti].dateChanged);
      const now = moment();

      if (lastChangeDate.isSame(now, 'day')) {
        record.weeklycommittedHoursHistory.pop();
      }

      const newEntry = {
        hours: record.weeklycommittedHours,
        dateChanged: Date.now(),
      };
      record.weeklycommittedHoursHistory.push(newEntry);
    }
  };

  const updateStartDate = (req, record) => {
    if (req.body.startDate !== undefined && record.startDate !== req.body.startDate) {
      record.startDate = moment.tz(req.body.startDate, 'America/Los_Angeles').toDate();
      if (record.weeklycommittedHoursHistory.length === 0) {
        const newEntry = {
          hours: record.weeklycommittedHours,
          dateChanged: Date.now(),
        };
        record.weeklycommittedHoursHistory.push(newEntry);
      }
      record.weeklycommittedHoursHistory[0].dateChanged = record.startDate;
    }
  };

  const updateImportantFields = async (req, record, isUserInCache, userData) => {
    if (!(await hasPermission(req.body.requestor, 'putUserProfileImportantInfo'))) return;

    const importantFields = [
      'email',
      'role',
      'isRehireable',
      'isActive',
      'weeklySummaries',
      'weeklySummariesCount',
      'mediaUrl',
      'collaborationPreference',
      'categoryTangibleHrs',
      'totalTangibleHrs',
      'timeEntryEditHistory',
    ];

    if (req.body.role !== record.role) {
      record.isVisible = req.body.role !== 'Mentor';
    }

    importantFields.forEach((fieldName) => {
      if (req.body[fieldName] !== undefined) {
        record[fieldName] = req.body[fieldName];
      }
    });

    if (req.body.missedHours !== undefined) {
      record.missedHours = req.body.role === 'Core Team' ? req.body?.missedHours ?? 0 : 0;
    }

    if (req.body.teams !== undefined) {
      record.teams = Array.from(new Set(req.body.teams));
    }

    await updateProjects(req, record);

    if (req.body.email !== undefined) {
      record.email = req.body.email.toLowerCase();
    }

    updateWeeklyCommittedHours(req, record);
    updateStartDate(req, record);

    if (req.body.endDate !== undefined) {
      if (yearMonthDayDateValidator(req.body.endDate)) {
        record.endDate = moment.tz(req.body.endDate, 'America/Los_Angeles').toDate();
        if (isUserInCache) {
          userData.endDate = record.endDate.toISOString();
        }
      } else {
        record.set('endDate', undefined, { strict: false });
      }
    }

    if (isUserInCache) {
      userData.role = record.role;
      userData.weeklycommittedHours = record.weeklycommittedHours;
      userData.email = record.email;
      userData.isActive = record.isActive;
      userData.startDate = record.startDate.toISOString();
    }
  };

  const checkChangeUserStatusAuthorization = async (req, userId) => {
    const { requestor } = req.body;

    const canEditProtectedAccount = await canRequestorUpdateUser(requestor.requestorId, userId);

    const hasChangeStatusPermission = await hasPermission(requestor, 'changeUserStatus');
    const hasFinalDayPermission = await hasPermission(requestor, 'setFinalDay');
    if (!(hasChangeStatusPermission && hasFinalDayPermission && canEditProtectedAccount)) {
      if (PROTECTED_EMAIL_ACCOUNT.includes(requestor.email)) {
        logger.logInfo(
          `Unauthorized attempt to change protected user status. Requestor: ${requestor.requestorId} Target: ${userId}`,
        );
      }
      return { authorized: false };
    }
    return { authorized: true };
  };

  const updateUserStatusAndCache = ({
    user,
    userId,
    status,
    isUserInCache,
    allUserData,
    userIdx,
  }) => {
    if (isUserInCache) {
      const userData = allUserData[userIdx];
      if (!status) {
        userData.endDate = user.endDate ? user.endDate.toISOString() : null;
      }
      userData.isActive = user.isActive;
      allUserData.splice(userIdx, 1, userData);
      cache.setCache('allusers', JSON.stringify(allUserData));
    }
  };

  const handleUserStatusSave = async ({
    user,
    userId,
    action,
    previousLifecycleStatus,
    lifecycleContext,
    recipients,
    req,
  }) => {
    const isUserInCache = cache.hasCache('allusers');
    let allUserData;
    let userIdx;

    if (isUserInCache) {
      allUserData = JSON.parse(cache.getCache('allusers'));
      userIdx = allUserData.findIndex((u) => u._id === userId);
    }

    updateUserStatusAndCache({
      user,
      userId,
      status: user.isActive,
      isUserInCache,
      allUserData,
      userIdx,
    });

    // =========================
    // LIFECYCLE EMAILS ONLY
    // =========================
    switch (action) {
      case UserStatusOperations.ACTIVATE:
        switch (previousLifecycleStatus) {
          case LifecycleStatus.PAUSE_TO_ACTIVE:
            userHelper.sendUserResumedEmail({
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              recipients,
              pausedOn: lifecycleContext.pausedOn,
            });
            break;

          case LifecycleStatus.SEPARATED_TO_ACTIVE:
            userHelper.sendUserReactivatedAfterSeparation({
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              recipients,
              previousEndDate: lifecycleContext.previousEndDate,
            });
            break;

          case LifecycleStatus.SCHEDULED_SEPARATION_TO_ACTIVE:
            userHelper.sendUserCancelledSeparationEmail({
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              recipients,
              previousEndDate: lifecycleContext.previousEndDate,
            });
            break;

          default:
            userHelper.sendUserActivatedEmail({
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              recipients,
            });
            break;
        }
        break;

      case UserStatusOperations.PAUSE:
        userHelper.sendUserPausedEmail({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          reactivationDate: user.reactivationDate,
          recipients,
        });
        break;

      case UserStatusOperations.DEACTIVATE:
        userHelper.sendUserSeparatedEmail({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          recipients,
          endDate: user.endDate,
        });
        break;

      case UserStatusOperations.SCHEDULE_DEACTIVATION:
        userHelper.sendUserScheduledSeparationEmail({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          endDate: user.endDate,
          recipients,
        });
        break;

      default:
        throw new Error('Invalid user status action');
    }

    auditIfProtectedAccountUpdated({
      requestorId: req.body.requestor.requestorId,
      updatedRecordEmail: user.email,
      originalRecord: null,
      updatedRecord: null,
      updateDiffPaths: null,
      actionPerformed: 'UserStatusUpdate',
    });
  };

  // Helper functions for deleteUserProfile
  const archiveUserTimeEntries = async (userId) => {
    const timeArchiveUser = await UserProfile.findOne(
      {
        firstName: process.env.TIME_ARCHIVE_FIRST_NAME,
        lastName: process.env.TIME_ARCHIVE_LAST_NAME,
      },
      '_id',
    );

    if (!timeArchiveUser) {
      logger.logException('Time Archive user was not found. Please check the database');
      throw new Error('Time Archive User not found');
    }

    await TimeEntry.updateMany(
      {
        personId: userId,
      },
      {
        $set: {
          personId: mongoose.Types.ObjectId(timeArchiveUser._id),
        },
      },
    );
  };

  const cleanupUserCache = (userId) => {
    cache.removeCache(`user-${userId}`);
    if (cache.getCache('allusers')) {
      const allUserData = JSON.parse(cache.getCache('allusers'));
      const userIdx = allUserData.findIndex((users) => users._id === userId);
      allUserData.splice(userIdx, 1);
      cache.setCache('allusers', JSON.stringify(allUserData));
    }
  };

  // Helper functions for putUserProfile
  const checkPutUserProfileAuthorization = async (req, userid) => {
    const canEditProtectedAccount = await canRequestorUpdateUser(
      req.body.requestor.requestorId,
      userid,
    );

    const isRequestorAuthorized = !!(
      canEditProtectedAccount &&
      ((await hasPermission(req.body.requestor, 'putUserProfile')) ||
        req.body.requestor.requestorId === userid)
    );

    const hasEditTeamCodePermission = await hasPermission(req.body.requestor, 'editTeamCode');
    const canManageAdminLinks = await hasPermission(req.body.requestor, 'manageAdminLinks');

    if (!isRequestorAuthorized && !canManageAdminLinks && !hasEditTeamCodePermission) {
      return { authorized: false, message: 'You are not authorized to update this user' };
    }

    if (
      req.body.role === 'Owner' &&
      !(await hasPermission(req.body.requestor, 'addDeleteEditOwners'))
    ) {
      return { authorized: false, message: 'You are not authorized to update this user' };
    }

    return { authorized: true, canManageAdminLinks };
  };

  const handleUserProfileUpdate = async (req, record, userid, canManageAdminLinks) => {
    let originalRecord = {};
    if (PROTECTED_EMAIL_ACCOUNT.includes(record.email)) {
      originalRecord = objectUtils.deepCopyMongooseObjectWithLodash(record);
    }

    if (!updateTeamCode(req, record)) {
      return { error: 'You are not authorized to edit team code.', status: 403 };
    }

    const originalinfringements = record.infringements ? record.infringements : [];
    updateCommonFields(req, record);

    const isUserInCache = cache.hasCache('allusers');
    let allUserData;
    let userData;
    let userIdx;
    if (isUserInCache) {
      allUserData = JSON.parse(cache.getCache('allusers'));
      userIdx = allUserData.findIndex((users) => users._id === userid);
      userData = allUserData[userIdx];
    }

    await updateSummaryFields(req, record);

    if (req.body.adminLinks !== undefined && canManageAdminLinks) {
      record.adminLinks = req.body.adminLinks;
    }

    if (req.body.isAcknowledged !== undefined && record.permissions) {
      record.permissions.isAcknowledged = req.body.isAcknowledged;
    }

    await updateImportantFields(req, record, isUserInCache, userData);

    let updatedDiff = null;
    if (PROTECTED_EMAIL_ACCOUNT.includes(record.email)) {
      updatedDiff = record.modifiedPaths();
    }

    return {
      originalRecord,
      originalinfringements,
      isUserInCache,
      allUserData,
      userData,
      userIdx,
      updatedDiff,
    };
  };

  const getUserProfiles = async function (req, res) {
    if (!(await checkPermission(req, 'getUserProfiles'))) {
      return forbidden(res, 'You are not authorized to view all users');
    }

    const cacheKey = 'allusers';
    try {
      // get user profiles using aggregate pipeline
      const users = await UserProfile.aggregate([
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            role: 1,
            weeklycommittedHours: 1,
            email: 1,
            permissions: 1,
            isActive: 1,
            reactivationDate: 1,
            startDate: 1,
            createdDate: 1,
            endDate: 1,
            lastActivityAt: 1,
            deactivatedAt: 1,
            timeZone: 1,
            filterColor: 1,
            bioPosted: 1,
            infringementCount: { $size: { $ifNull: ['$infringements', []] } },
            jobTitle: {
              $cond: {
                if: { $isArray: '$jobTitle' },
                then: {
                  $reduce: {
                    input: '$jobTitle',
                    initialValue: '',
                    in: {
                      $cond: {
                        if: { $eq: ['$$value', ''] },
                        then: '$$this',
                        else: { $concat: ['$$value', ', ', '$$this'] },
                      },
                    },
                  },
                },
                else: '$jobTitle',
              },
            },
          },
        },
        { $sort: { startDate: -1, createdDate: -1 } },
      ]);

      if (!users || users.length === 0) {
        const cachedData = cache.getCache(cacheKey);
        if (cachedData) {
          return res.status(200).send(JSON.parse(cachedData));
        }
        return res.status(500).send({ error: 'User result was invalid' });
      }

      cache.setCache(cacheKey, JSON.stringify(users));
      return res.status(200).send(users);
    } catch (error) {
      return res
        .status(500)
        .send({ error: 'Failed to fetch user profiles', details: error.message });
    }
  };

  /**
   * Controller function to retrieve basic user profile information.
   * This endpoint checks if the user has the necessary permissions to access user profiles.
   * If the source is "report", it checks for "getReport" permission.
   * For other sources, it checks for "getUserProfiles" permission.
   * If authorized, it queries the database to fetch only the required fields:
   * _id, firstName, lastName, isActive, startDate, and endDate, sorted by last name.
   *
   */
  const getUserProfileBasicInfo = async function (req, res) {
    const inputUserId = req.query.userId;
    logger.logInfo(
      `getUserProfileBasicInfo, { userId:${req.query.userId}, source:${req.params?.source} }`,
    );

    if (inputUserId) {
      try {
        const cacheKey = `user_${inputUserId}`;
        const cachedUser = cache.getCache(cacheKey);
        if (cachedUser) {
          return res.status(200).send(JSON.parse(cachedUser));
        }
        const user = await UserProfile.findById(
          inputUserId,
          '_id firstName lastName isActive startDate createdDate endDate',
        );
        if (!user) {
          return res.status(404).send({ error: 'User Not found' });
        }

        cache.setCache(cacheKey, JSON.stringify(user));
        return res.status(200).send(user);
      } catch (error) {
        return res.status(500).send({ error: 'Failed to fetch userProfile' });
      }
    }

    const { source } = req.params;
    if (!source) {
      return res.status(400).send({ error: 'Source parameter is required' });
    }

    const permission = source === 'Report' ? 'getReports' : 'getUserProfiles';
    const userHasPermission = await checkPermission(req, permission);

    if (!userHasPermission) {
      return res.status(403).send({ error: 'Unauthorized' });
    }

    try {
      // Debug: Check total count first
      const totalCount = await UserProfile.countDocuments({});
      logger.logInfo(`getUserProfileBasicInfo - Total users in database: ${totalCount}`);

      const userProfiles = await UserProfile.find(
        {},
        '_id firstName lastName isActive startDate createdDate endDate jobTitle role email phoneNumber profilePic filterColor', // Include profilePic
      )
        .sort({
          lastName: 1,
        })
        .lean();

      logger.logInfo(`getUserProfileBasicInfo - Found ${userProfiles.length} user profiles`);
      res.status(200).json(userProfiles);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
      logger.logError('Error fetching user profiles:', error);
      res.status(500).send({ error: 'Failed to fetch user profiles', details: error.message });
    }
  };

  const getProjectMembers = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'getProjectMembers'))) {
      res.status(403).send('You are not authorized to view all users');
      return;
    }
    UserProfile.find(
      {
        projects: {
          $in: [req.params.projectId],
        },
      },
      '_id firstName email',
      (err, profiles) => {
        if (err) {
          res.status(404).send('Error finding user profiles');
          return;
        }
        res.json(profiles);
      },
    );
  };

  const searchUsersByName = async function (req, res) {
    // if (!(await checkPermission(req, 'searchUserProfile'))) {
    //   forbidden(res, 'You are not authorized to search for users');
    //   return;
    // }
    const { name } = req.query;

    const result = await UserProfile.find({
      $expr: {
        $regexMatch: {
          input: { $concat: ['$firstName', ' ', '$lastName'] },
          regex: name,
          options: 'i',
        },
      },
    })
      .limit(SEARCH_RESULT_LIMIT)
      .select({ firstName: 1, lastName: 1, _id: 1 })
      .sort({ firstName: 1, lastName: 1 });
    res.json(result);
  };

  const postUserProfile = async function (req, res) {
    if (!(await checkPermission(req, 'postUserProfile'))) {
      forbidden(res, 'You are not authorized to create new users');
      return;
    }

    if (req.body.role === 'Owner' && !(await checkPermission(req, 'addDeleteEditOwners'))) {
      forbidden(res, 'You are not authorized to create new owners');
      return;
    }

    const userByEmail = await validateUserEmail(req.body.email);
    if (userByEmail) {
      res.status(400).send({
        error: 'That email address is already in use. Please choose another email address.',
        type: 'email',
      });
      return;
    }

    // In dev environment, if newly created user is Owner or Administrator, make fetch request to Beta login route
    if (process.env.dbName === 'hgnData_dev') {
      if (req.body.role === 'Owner' || req.body.role === 'Administrator') {
        try {
          const isValid = await validateBetaCredentials(
            req.body.actualEmail,
            req.body.actualPassword,
          );
          if (!isValid) {
            throw new Error('Invalid credentials');
          }
        } catch (error) {
          res.status(400).send({
            error:
              'The actual email or password you provided is incorrect. Please enter the actual email and password associated with your account in the Main HGN app.',
            type: 'credentials',
          });
          return;
        }
      }
    }

    const duplicatePhoneNumberCheck = false;
    if (duplicatePhoneNumberCheck) {
      const userByPhoneNumber = await UserProfile.findOne({
        phoneNumber: req.body.phoneNumber,
      });
      if (userByPhoneNumber) {
        res.status(400).send({
          error: 'That phone number is already in use. Please choose another number.',
          type: 'phoneNumber',
        });
        return;
      }
    }

    const userDuplicateName = await UserProfile.findOne({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
    });
    if (userDuplicateName && !req.body.allowsDuplicateName) {
      res.status(400).send({
        error: 'That name is already in use. Please confirm if you want to use this name.',
        type: 'name',
      });
      return;
    }

    const up = createUserFromRequest(req);

    try {
      const requestor = await UserProfile.findById(req.body.requestor.requestorId)
        .select('firstName lastName email role')
        .exec();

      await up.save().then(() => {
        sendNewRoleEmail(up, requestor);
      });

      updateCacheForNewUser(up);

      res.status(200).send({
        _id: up._id,
      });
    } catch (error) {
      res.status(501).send(error);
    }
  };

  const toggleUserBioPosted = async function (req, res) {
    try {
      const { userId } = req.params;
      const { bioPosted } = req.body;

      // validate input
      if (!bioPosted || !['posted', 'requested', 'default'].includes(bioPosted)) {
        return res.status(400).json({ error: 'Invalid or missing bioPosted value.' });
      }

      const canEditProtectedAccount = await canRequestorUpdateUser(
        req.body.requestor.requestorId,
        userId,
      );
      const canToggleRequestBio = await hasPermission(req.body.requestor, 'requestBio');

      if (!canEditProtectedAccount && !canToggleRequestBio) {
        return res.status(403).json({ error: 'Permission denied to toggle bio.' });
      }

      // Update bioPosted
      const updatedUser = await userService.updateBioPostedStatus(userId, bioPosted);

      // Verify the update was successful by fetching the user directly from DB
      const verificationUser = await UserProfile.findById(userId, 'bioPosted firstName lastName');
      console.log(
        `Database verification - User: ${verificationUser.firstName} ${verificationUser.lastName}, bioPosted: ${verificationUser.bioPosted}`,
      );

      if (verificationUser.bioPosted !== bioPosted) {
        console.error(
          `WARNING: Database update failed! Expected: ${bioPosted}, Actual: ${verificationUser.bioPosted}`,
        );
        return res.status(500).json({ error: 'Failed to update bio status in database.' });
      }

      // Clear caches to ensure updated data is displayed
      cache.removeCache(`user-${userId}`);

      // Update or invalidate the allusers cache if it exists
      if (cache.hasCache('allusers')) {
        const allUserData = JSON.parse(cache.getCache('allusers'));
        const userIndex = allUserData.findIndex((user) => user._id === userId);

        if (userIndex !== -1) {
          // Update the bioPosted field in the cache
          allUserData[userIndex].bioPosted = bioPosted;
          cache.setCache('allusers', JSON.stringify(allUserData));
        } else {
          // If user not found in cache, invalidate entire cache to be safe
          cache.removeCache('allusers');
        }
      }

      // Clear weekly summaries caches since bio status affects the weekly summaries report
      // Invalidate cache for each week (0-3) - this will also invalidate the 'all' cache
      console.log('Invalidating weekly summaries cache for bio status update for user:', userId);
      for (let week = 0; week <= MAX_WEEKS_FOR_CACHE_INVALIDATION; week += 1) {
        console.log(`Invalidating cache for week: ${week}`);
        reportsController.invalidateWeeklySummariesCache(week);
      }
      console.log('All weekly summaries caches invalidated');

      // Force clear all potential cache keys
      for (let week = 0; week <= MAX_WEEKS_FOR_CACHE_CLEAR; week += 1) {
        cache.removeCache(`weeklySummaries_${week}`);
      }
      cache.removeCache('weeklySummaries_all');
      cache.removeCache('weeklySummaries_null');
      cache.removeCache('weeklySummaries_undefined');
      console.log('Manual cache clearing completed');

      return res.status(200).json({
        message: `Bio status updated to "${bioPosted}" successfully.`,
        user: updatedUser,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
    }
  };

  const putUserProfile = async function (req, res) {
    console.log('➡️ PUT /userprofile triggered');
    console.log('UserID:', req.params.userId);
    console.log('Incoming body keys:', Object.keys(req.body));
    console.log('🟩 PUT /userProfile called with:', req.params.userId);
    console.log('🟩 Payload received:', JSON.stringify(req.body, null, 2));

    const userid = req.params.userId;

    const authResult = await checkPutUserProfileAuthorization(req, userid);
    if (!authResult.authorized) {
      return res.status(403).send(authResult.message);
    }

    cache.removeCache(`user-${userid}`);

    try {
      const record = await UserProfile.findById(userid);
      if (!record) {
        return res.status(404).send('No valid records found');
      }

      if (!Array.isArray(record.summarySubmissionDates)) {
        record.summarySubmissionDates = [];
      } else {
        record.summarySubmissionDates = record.summarySubmissionDates.filter((d) => {
          const dateObj = new Date(d);
          return !Number.isNaN(dateObj.getTime());
        });
      }

      if (req.body.filterColor !== undefined) {
        record.filterColor = req.body.filterColor;
        record.lastModifiedDate = Date.now();
        console.log('Setting filterColor:', req.body.filterColor);
      }

      const updateResult = await handleUserProfileUpdate(
        req,
        record,
        userid,
        authResult.canManageAdminLinks,
      );

      if (updateResult?.error) {
        return res.status(updateResult.status).send(updateResult.error);
      }

      const {
        originalRecord,
        originalinfringements,
        isUserInCache,
        allUserData: allUserDataFromUpdate,
        updatedDiff,
      } = updateResult || {};

      const results = await record.save();

      await userHelper.notifyInfringements(
        originalinfringements || (record.infringements ? record.infringements : []),
        results.infringements,
        results.firstName,
        results.lastName,
        results.email,
        results.role,
        results.startDate,
        results.jobTitle?.[0],
        results.weeklycommittedHours,
      );

      console.log('✅ Saved filterColor in DB:', results.filterColor);
      console.log('Backend: Save successful for user:', userid);

      [
        'weeklySummaries_0',
        'weeklySummaries_1',
        'weeklySummaries_3',
        'weeklySummaries_all',
        'weeklySummariesReport',
        `weeklySummaries_user_${userid}`,
        'allusers',
        `user-${userid}`,
      ].forEach((key) => cache.removeCache(key));
      cache.clearByPrefix('weeklySummaries');

      if (cache.hasCache('allusers')) {
        try {
          const allUsers = JSON.parse(cache.getCache('allusers'));
          const idx = allUsers.findIndex((u) => u._id === userid);
          if (idx !== -1) {
            allUsers[idx].filterColor = results.filterColor;
            allUsers[idx].projects = results.projects;
            allUsers[idx].teams = results.teams;
            cache.setCache('allusers', JSON.stringify(allUsers));
          }
        } catch (e) {
          console.error('❌ Failed to update allusers cache:', e);
        }
      }

      if (req.body?.requestor?.requestorId) {
        auditIfProtectedAccountUpdated({
          requestorId: req.body.requestor.requestorId,
          updatedRecordEmail: originalRecord?.email || record.email,
          originalRecord,
          updatedRecord: record, // or results
          updateDiffPaths: updatedDiff,
          actionPerformed: 'update',
        });
      }

      return res.status(200).json({
        _id: results._id,
        filterColor: results.filterColor,
        projects: results.projects,
        teams: results.teams,
      });
    } catch (error) {
      console.error('❌ Backend: putUserProfile FAILED:', error);

      if (error?.name === 'ValidationError') {
        const errors = Object.values(error.errors || {}).map((er) => er.message);
        return res.status(400).json({
          message: 'Validation Error during save',
          error: errors,
        });
      }

      return res.status(500).json({
        message: 'Internal server error during save.',
        error: error.message || 'Unknown save error',
      });
    }
  };

  const deleteUserProfile = async function (req, res) {
    const { option, userId } = req.body;
    const canEditProtectedAccount = await canRequestorUpdateUser(
      req.body.requestor.requestorId,
      userId,
    );
    if (!(await hasPermission(req.body.requestor, 'deleteUserProfile'))) {
      res.status(403).send('You are not authorized to delete users');
      return;
    }

    if (
      req.body.role === 'Owner' &&
      !(await hasPermission(req.body.requestor, 'addDeleteEditOwners'))
    ) {
      res.status(403).send('You are not authorized to delete this user');
      return;
    }

    if (!userId || !option || (option !== 'delete' && option !== 'archive')) {
      res.status(400).send({
        error: 'Bad request',
      });
      return;
    }

    if (userId === req.body.requestor) {
      res.status(403).send({
        error: 'You cannot delete your own account',
      });
      return;
    }

    const user = await UserProfile.findById(userId);

    // Check if the user is protected and if the requestor has permission to delete protected accounts
    if (PROTECTED_EMAIL_ACCOUNT.includes(user.email) && !canEditProtectedAccount) {
      res.status(403).send({
        error: 'Only authorized users can delete protected accounts',
      });
      //
      logger.logInfo(
        `Unauthorized attempt to delete a protected account. Requestor: ${req.body.requestor.requestorId} Target: ${user.email}`,
      );
      return;
    }

    if (!user) {
      res.status(400).send({
        error: 'Invalid user',
      });
      return;
    }

    if (option === 'archive') {
      try {
        await archiveUserTimeEntries(userId);
      } catch (error) {
        res.status(500).send({
          error:
            'Time Archive User not found. Please contact your developement team on why that happened',
        });
        return;
      }
    }

    cleanupUserCache(userId);
    const originalRecord = objectUtils.deepCopyMongooseObjectWithLodash(user);
    try {
      await UserProfile.deleteOne({ _id: userId });
      // delete followUp for deleted user
      await followUp.findOneAndDelete({ userId });
      res.status(200).send({ message: 'Executed Successfully' });
      auditIfProtectedAccountUpdated({
        requestorId: req.body.requestor.requestorId,
        updatedRecordEmail: originalRecord.email,
        originalRecord,
        updatedRecord: null,
        updateDiffPaths: null,
        actionPerformed: 'delete',
      });
    } catch (err) {
      res.status(500).send(err);
    }
  };

  const getUserById = (req, res) => {
    const userid = req.params.userId;

    return UserProfile.findById(userid, '-password -refreshTokens -lastModifiedDate -__v')
      .populate([
        {
          path: 'teams',
          select: '_id teamName',
          options: { sort: { teamName: 1 } },
        },
        {
          path: 'projects',
          select: '_id projectName category',
          options: { sort: { projectName: 1 } },
        },
        {
          path: 'badgeCollection',
          populate: {
            path: 'badge',
            model: Badge,
            select: '_id badgeName type imageUrl description ranking showReport',
          },
        },
        {
          path: 'infringements',
          select: '_id date description createdDate',
          options: { sort: { date: -1 } },
        },
        {
          path: 'oldInfringements',
          select: '_id date description createdDate',
          options: { sort: { date: -1 } },
        },
      ])
      .exec()
      .then(async (user) => {
        if (!user) {
          return res.status(400).send({ error: 'This is not a valid user' });
        }

        const current = Array.isArray(user.infringements) ? user.infringements : [];
        const old = Array.isArray(user.oldInfringements) ? user.oldInfringements : [];

        const combined = [...current, ...old];

        // build date -> best record
        const byDate = new Map();

        for (const inf of combined) {
          if (!inf?.date) continue;

          const existing = byDate.get(inf.date);
          if (!existing) {
            byDate.set(inf.date, inf);
            continue;
          }

          const a = inf.createdDate ? new Date(inf.createdDate).getTime() : 0;
          const b = existing.createdDate ? new Date(existing.createdDate).getTime() : 0;

          if (a > b) {
            byDate.set(inf.date, inf);
            continue;
          }

          const ida = String(inf._id || '');
          const idb = String(existing._id || '');
          if (ida > idb) {
            byDate.set(inf.date, inf);
          }
        }

        const infringements = Array.from(byDate.values()).sort((a, b) =>
          a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
        );

        user.set('infringements', infringements, { strict: false });
        user.set('oldInfringements', undefined, { strict: false });

        cache.setCache(`user-${userid}`, JSON.stringify(user));
        return res.status(200).send(user);
      })
      .catch((error) => res.status(404).send(error));
  };

  const getUserByName = (req, res) => {
    const { name } = req.params;
    UserProfile.find(
      { firstName: name.split(' ')[0], lastName: name.split(' ')[1] },
      '_id, profilePic, badgeCollection',
    )

      .then((results) => {
        res.status(200).send(results);
      })
      .catch((error) => res.status(404).send(error));
  };

  const updateOneProperty = async (req, res) => {
    const { userId } = req.params;
    const { key, value, requestor } = req.body;

    // remove user from cache so it reloads next time
    cache.removeCache(`user-${userId}`);

    if (!key || value === undefined) {
      return res.status(400).send({ error: 'Missing property or value' });
    }

    try {
      const user = await UserProfile.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Keep original record for protected accounts
      let originalRecord = null;
      if (PROTECTED_EMAIL_ACCOUNT.includes(user.email)) {
        originalRecord = objectUtils.deepCopyMongooseObjectWithLodash(user);
      }

      // ✅ Normalize filterColor (YOUR LOGIC – CRITICAL)
      let payloadValue = value;
      if (key === 'filterColor') {
        if (Array.isArray(value)) {
          payloadValue = value.map((c) => c.trim()).filter(Boolean);
        } else if (typeof value === 'string') {
          payloadValue = value
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
        } else {
          payloadValue = [];
        }
        console.log('🛠 filterColor normalized to:', payloadValue);
      }

      user.set({ [key]: payloadValue });

      let updatedDiff = null;
      if (PROTECTED_EMAIL_ACCOUNT.includes(user.email)) {
        updatedDiff = user.modifiedPaths();
      }

      await user.save();

      console.log(`✅ Saved ${key} in DB:`, user[key]);

      // ================================
      // CACHE INVALIDATION (MERGED)
      // ================================
      try {
        cache.removeCache(`user-${userId}`);
        cache.removeCache('allusers');
        cache.removeCache('teamCodes');

        cache.clearByPrefix('weeklySummaries');
        cache.removeCache('weeklySummaries_all');
        cache.removeCache('weeklySummaries_null');
        cache.removeCache('weeklySummaries_undefined');
      } catch (e) {
        console.error('Cache clearing error:', e);
      }

      // Patch allusers cache if present
      if (cache.hasCache('allusers')) {
        const allUserData = JSON.parse(cache.getCache('allusers'));
        const idx = allUserData.findIndex((u) => u._id === userId);
        if (idx !== -1) {
          allUserData[idx][key] = user[key];
          cache.setCache('allusers', JSON.stringify(allUserData));
        }
      }

      // Special case: bioPosted invalidates weekly summaries
      if (key === 'bioPosted') {
        try {
          for (let week = 0; week <= MAX_WEEKS_FOR_CACHE_INVALIDATION; week += 1) {
            reportsController.invalidateWeeklySummariesCache(week);
          }
        } catch (e) {
          console.error('Error invalidating weekly summaries after bioPosted:', e);
        }
      }

      // Respond
      res.status(200).json({
        _id: user._id,
        [key]: user[key],
      });

      // ================================
      // AUDIT (DEV BRANCH – PRESERVED)
      // ================================
      if (originalRecord) {
        auditIfProtectedAccountUpdated({
          requestorId: requestor?.requestorId,
          updatedRecordEmail: originalRecord.email,
          originalRecord,
          updatedRecord: user,
          updateDiffPaths: updatedDiff,
          actionPerformed: 'update',
        });
      }
    } catch (err) {
      console.error(`❌ Failed to update property ${key}:`, err);
      return res.status(500).json({ error: 'Failed to update user property' });
    }
  };
  const updateAllMembersTeamCode = async (req, res) => {
    const canEditTeamCode = await hasPermission(req.body.requestor, 'editTeamCode');
    if (!canEditTeamCode) {
      res.status(403).send('You are not authorized to edit team code.');
      return;
    }
    const { userIds, replaceCode } = req.body;
    if (userIds === null || userIds.length <= 0 || replaceCode === undefined) {
      return res.status(400).send({ error: 'Missing property or value' });
    }
    return UserProfile.updateMany({ _id: { $in: userIds } }, { $set: { teamCode: replaceCode } })
      .then((result) => res.status(200).send({ isUpdated: result.nModified > 0 }))
      .catch((error) => res.status(500).send(error));
  };

  const updatepassword = async function (req, res) {
    const { userId } = req.params;
    const { requestor } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({
        error: 'Bad Request',
      });
    }

    // Verify correct params in body
    if (!req.body.currentpassword || !req.body.newpassword || !req.body.confirmnewpassword) {
      return res.status(400).send({
        error: 'One of more required fields are missing',
      });
    }
    // Check if the requestor has the permission to update passwords.
    const canEditProtectedAccount = await canRequestorUpdateUser(
      req.body.requestor.requestorId,
      userId,
    );

    if (!canEditProtectedAccount) {
      logger.logInfo(
        `Unauthorized attempt to update a protected account. Requestor: ${req.body.requestor.requestorId} Target: ${userId}`,
      );
      res.status(403).send('You are not authorized to update this user');
      return;
    }

    const hasUpdatePasswordPermission = await hasPermission(requestor, 'updatePassword');

    // if they're updating someone else's password, they need the 'updatePassword' permission.
    if (userId !== requestor.requestorId && !hasUpdatePasswordPermission) {
      return res.status(403).send({
        error: "You are unauthorized to update this user's password",
      });
    }

    // Verify new and confirm new password are correct
    if (req.body.newpassword !== req.body.confirmnewpassword) {
      return res.status(400).send({
        error: 'New and confirm new passwords are not the same',
      });
    }

    // Verify old and new passwords are not same
    if (req.body.currentpassword === req.body.newpassword) {
      res.status(400).send({
        error: 'Old and new passwords should not be same',
      });
    }

    return UserProfile.findById(userId, 'password')
      .then((user) => {
        bcrypt
          .compare(req.body.currentpassword, user.password)
          .then((passwordMatch) => {
            if (!passwordMatch) {
              return res.status(400).send({
                error: 'Incorrect current password',
              });
            }

            user.set({
              password: req.body.newpassword,
              resetPwd: undefined,
            });
            return user
              .save()
              .then(() => {
                if (PROTECTED_EMAIL_ACCOUNT.includes(user.email)) {
                  logger.logInfo(
                    `Protected email account password updated. Requestor: ${req.body.requestor.requestorId}, Target: ${user.email}`,
                  );
                }
                res.status(200).send({ message: 'updated password' });
                auditIfProtectedAccountUpdated({
                  requestorId: req.body.requestor.requestorId,
                  updatedRecordEmail: user.email,
                  originalRecord: null,
                  updatedRecord: null,
                  updateDiffPaths: null,
                  actionPerformed: 'PasswordUpdate',
                });
              })
              .catch((error) => res.status(500).send(error));
          })
          .catch((error) => res.status(500).send(error));
      })
      .catch((error) => res.status(500).send(error));
  };

  const getreportees = async function (req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      res.status(400).send({
        error: 'Bad request',
      });
      return;
    }

    const userid = mongoose.Types.ObjectId(req.params.userId);

    let validroles = ['Volunteer', 'Manager', 'Administrator', 'Core Team', 'Owner', 'Mentor'];

    if (await hasPermission(req.body.requestor, 'getReporteesLimitRoles')) {
      validroles = ['Volunteer', 'Manager'];
    }

    userHelper
      .getTeamMembers({
        _id: userid,
      })
      .then((results) => {
        const teammembers = [];

        results.myteam.forEach((element) => {
          if (!validroles.includes(element.role)) return;
          teammembers.push(element);
        });
        res.status(200).send(teammembers);
      })
      .catch((error) => res.status(400).send(error));
  };

  const getTeamMembersofUser = function (req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      res.status(400).send({
        error: 'Bad request',
      });
      return;
    }
    userHelper
      .getTeamMembers({
        _id: req.params.userId,
      })
      .then((results) => {
        res.status(200).send(results);
      })
      .catch((error) => res.status(400).send(error));
  };

  const getUserName = function (req, res) {
    const { userId } = req.params;

    if (mongoose.Types.ObjectId.isValid(userId)) {
      UserProfile.findById(userId, 'firstName lastName')
        .then((result) => {
          const name = `${result.firstName} ${result.lastName}`;
          res.status(200).send({
            name,
          });
        })
        .catch((error) => {
          res.status(404).send(error);
        });
    } else {
      res.status(400).send({
        error: 'Bad request',
      });
    }
  };

  const getPreviousLifecycleStatus = (user) => {
    if (user.reactivationDate) {
      return LifecycleStatus.PAUSE_TO_ACTIVE;
    }
    if (user.endDate && user.inactiveReason === InactiveReason.SCHEDULED_SEPARATION) {
      return LifecycleStatus.SCHEDULED_SEPARATION_TO_ACTIVE;
    }
    if (!user.isActive) {
      return LifecycleStatus.SEPARATED_TO_ACTIVE;
    }
    return null;
  };

  const changeUserStatus = async function (req, res) {
    const { userId } = req.params;
    const { action, endDate, reactivationDate } = req.body;

    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).send({ error: 'Bad Request' });
      }

      const authResult = await checkChangeUserStatusAuthorization(req, userId);
      if (!authResult.authorized) {
        return res.status(403).send('You are not authorized to change user status');
      }

      cache.removeCache(`user-${userId}`);
      const recipients = await userHelper.getEmailRecipientsForStatusChange(userId);

      const user = await UserProfile.findById(
        userId,
        'isActive email firstName lastName teams teamCode endDate isSet finalEmailThreeWeeksSent reactivationDate inactiveReason',
      );

      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }

      const wasInactive = !user.isActive;
      const previousLifecycleStatus = getPreviousLifecycleStatus(user);
      const lifecycleContext = {
        pausedOn: user.inactiveReason === InactiveReason.PAUSED ? user.deactivatedAt : null,
        previousEndDate:
          user.inactiveReason === InactiveReason.SCHEDULED_SEPARATION ||
          user.inactiveReason === InactiveReason.SEPARATED
            ? user.endDate
            : null,
      };

      switch (action) {
        case UserStatusOperations.ACTIVATE: {
          user.isActive = true;
          user.inactiveReason = undefined;
          user.deactivatedAt = null;
          user.reactivationDate = null;
          user.endDate = null;
          user.isSet = false;
          user.finalEmailThreeWeeksSent = false;
          break;
        }

        case UserStatusOperations.DEACTIVATE: {
          if (!endDate) {
            return res.status(400).send({ error: 'End date is required for deactivation' });
          }
          user.isActive = false;
          user.inactiveReason = InactiveReason.SEPARATED;
          user.endDate = moment(endDate).tz(COMPANY_TZ).endOf('day').toISOString();
          user.deactivatedAt = moment().tz(COMPANY_TZ).toISOString();
          user.reactivationDate = null;
          user.isSet = true;
          break;
        }

        case UserStatusOperations.SCHEDULE_DEACTIVATION: {
          if (!endDate) {
            return res
              .status(400)
              .send({ error: 'End date is required for scheduled deactivation' });
          }
          user.isActive = true;
          user.inactiveReason = InactiveReason.SCHEDULED_SEPARATION;
          user.endDate = moment(endDate).tz(COMPANY_TZ).endOf('day').toISOString();
          user.deactivatedAt = null;
          user.reactivationDate = null;
          user.isSet = true;
          break;
        }

        case UserStatusOperations.PAUSE: {
          if (!reactivationDate) {
            return res.status(400).send({ error: 'Reactivation date is required for pause' });
          }
          user.isActive = false;
          user.inactiveReason = InactiveReason.PAUSED;
          user.deactivatedAt = moment().tz(COMPANY_TZ).toISOString();
          user.reactivationDate = moment(reactivationDate)
            .tz(COMPANY_TZ)
            .startOf('day')
            .toISOString();
          user.endDate = null;
          user.isSet = false;
          break;
        }

        default:
          return res.status(400).send({ error: 'Invalid action' });
      }

      // =========================
      // TEAM CODE WARNING LOGIC
      // =========================
      if (!user.isActive) {
        user.teamCodeWarning = false;
      } else if (wasInactive) {
        const mismatch = await userHelper.checkTeamCodeMismatch(user);
        if (mismatch) {
          user.teamCodeWarning = true;
        }
      }
      await user.save();

      await handleUserStatusSave({
        user,
        userId,
        action,
        previousLifecycleStatus,
        lifecycleContext,
        recipients,
        req,
      });

      return res.status(200).send({ message: 'status updated' });
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  };

  const changeUserRehireableStatus = async function (req, res) {
    const { userId } = req.params;
    const { isRehireable } = req.body;
    const canEditProtectedAccount = await canRequestorUpdateUser(
      req.body.requestor.requestorId,
      userId,
    );
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({ error: 'Bad Request' });
    }
    if (
      !(await hasPermission(req.body.requestor, 'changeUserRehireableStatus')) ||
      !canEditProtectedAccount
    ) {
      return res.status(403).send('You are not authorized to change rehireable status');
    }

    // Invalidate the cache for this user
    cache.removeCache(`user-${userId}`);

    UserProfile.findByIdAndUpdate(
      userId,
      { $set: { isRehireable } },
      { new: true },
      // eslint-disable-next-line no-unused-vars
      (error, updatedUser) => {
        if (error) {
          return res.status(500).send(error);
        }
        // Check if there's a cache for all users and update it accordingly
        const isUserInCache = cache.hasCache('allusers');
        if (isUserInCache) {
          const allUserData = JSON.parse(cache.getCache('allusers'));
          const userIdx = allUserData.findIndex((users) => users._id === userId);
          const userData = allUserData[userIdx];
          userData.isRehireable = isRehireable;
          allUserData.splice(userIdx, 1, userData);
          cache.setCache('allusers', JSON.stringify(allUserData));
        }

        // Optionally, re-fetch the user to verify the updated data
        UserProfile.findById(userId, (err, verifiedUser) => {
          if (err) {
            return res.status(500).send('Error fetching updated user data.');
          }
          auditIfProtectedAccountUpdated({
            requestorId: req.body.requestor.requestorId,
            updatedRecordEmail: verifiedUser.email,
            originalRecord: null,
            updatedRecord: null,
            updateDiffPaths: null,
            actionPerformed: 'UserRehireableStatusUpdate',
          });
          res.status(200).send({
            message: 'Rehireable status updated and verified successfully',
            isRehireable: verifiedUser.isRehireable,
          });
        });
      },
    );
  };

  const resetPassword = async function (req, res) {
    try {
      await ValidatePassword(req);

      const requestor = await UserProfile.findById(req.body.requestor.requestorId)
        .select('firstName lastName email role')
        .exec();

      if (!requestor) {
        res.status(404).send({ error: 'Requestor not found' });
        return;
      }

      const user = await UserProfile.findById(req.params.userId)

        .select('firstName lastName email role')
        .exec();

      if (!user) {
        res.status(404).send({ error: 'User not found' });
        return;
      }

      if (user.role === 'Owner' && !(await hasPermission(requestor, 'addDeleteEditOwners'))) {
        res.status(403).send('You are not authorized to reset this user password');
        return;
      }

      user.password = req.body.newpassword;

      await user.save();

      const condition =
        process.env.dbName === 'hgnData_dev'
          ? user.role === 'Owner'
          : user.role === 'Owner' || user.role === 'Administrator';
      if (condition) {
        const subject = `${process.env.dbName !== 'hgnData_dev' ? '*Main Site* -' : ''}${user.role} Password Reset Notification`;
        const emailBody = `<p>Hi Admin! </p>

        <p><strong>Account Details</strong></p>
        <p>This email is to inform you that a password reset has been executed for an ${user.role} account:</p>

        <ul>
            <li><strong>Name:</strong> ${user.firstName} ${user.lastName}</li>
            <li><strong>Email:</strong> <a href="mailto:${user.email}">${user.email}</a></li>
        </ul>

        <p><strong>Account that reset the ${user.role}'s password</strong></p>
        <p>The password reset was made by:</p>

        <ul>
            <li><strong>Name:</strong> ${requestor.firstName} ${requestor.lastName}</li>
            <li><strong>Email:</strong> <a href="mailto:${requestor.email}">${requestor.email}</a></li>
        </ul>

        <p>If you have any questions or need to verify this password reset, please investigate further.</p>

        <p>Thank you for your attention to this matter.</p>

        <p>Sincerely,</p>
        <p>The HGN A.I. (and One Community)</p>
        `;

        emailSender('onecommunityglobal@gmail.com', subject, emailBody, null, null);
      }

      res.status(200).send({
        message: 'Password Reset',
      });
      auditIfProtectedAccountUpdated({
        requestorId: req.body.requestor.requestorId,
        updatedRecordEmail: user.email,
        originalRecord: null,
        updatedRecord: null,
        updateDiffPaths: null,
        actionPerformed: 'UserResetPassword',
      });
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const getAllUsersWithFacebookLink = function (req, res) {
    try {
      UserProfile.find({ 'personalLinks.Name': 'Facebook' }).then((results) => {
        res.status(200).send(results);
      });
    } catch (error) {
      res.status(400).send(error);
    }
  };
  const refreshToken = async (req, res) => {
    const { JWT_SECRET } = config;
    const user = await UserProfile.findById(req.params.userId);

    if (!user) {
      res.status(403).send({ message: 'User does not exist' });
      return;
    }

    const jwtPayload = {
      userid: user._id,
      role: user.role,
      permissions: user.permissions,
      access: {
        canAccessBMPortal: false,
      },
      expiryTimestamp: moment().add(config.TOKEN.Lifetime, config.TOKEN.Units).toISOString(),
    };
    const currentRefreshToken = jwt.sign(jwtPayload, JWT_SECRET);
    res.status(200).send({ refreshToken: currentRefreshToken });
  };

  const getUserBySingleName = (req, res) => {
    const pattern = new RegExp(`^${req.params.singleName}`, 'i');

    UserProfile.find({
      $or: [{ firstName: { $regex: pattern } }, { lastName: { $regex: pattern } }],
    })
      .select('firstName lastName')
      // eslint-disable-next-line consistent-return
      .then((users) => {
        if (users.length === 0) {
          return res.status(404).send({ error: 'Users Not Found' });
        }
        res.status(200).send(users);
      })
      .catch((error) => res.status(500).send(error));
  };
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Search for user by full name (first and last)
  // eslint-disable-next-line consistent-return
  const getUserByFullName = (req, res) => {
    // Sanitize user input and escape special characters
    const sanitizedFullName = escapeRegExp(req.params.fullName.trim());
    // Create a regular expression to match the sanitized full name, ignoring case
    const fullNameRegex = new RegExp(sanitizedFullName, 'i');

    UserProfile.find({
      $or: [{ firstName: { $regex: fullNameRegex } }, { lastName: { $regex: fullNameRegex } }],
    })
      .select('firstName lastName')
      // eslint-disable-next-line consistent-return
      .then((users) => {
        if (users.length === 0) {
          return res.status(404).send({ error: 'Users Not Found' });
        }

        res.status(200).send(users);
      })
      .catch((error) => res.status(500).send(error));
  };

  const authorizeUser = async (req, res) => {
    try {
      let authorizedUser;
      if (req.body.currentUser === authorizedUserJae) {
        authorizedUser = authorizedUserJae;
      } else if (req.body.currentUser === authorizedUserSara) {
        authorizedUser = authorizedUserSara;
      }
      await UserProfile.findOne({
        email: {
          $regex: escapeRegex(authorizedUser), // The Authorized user's email
          $options: 'i',
        },
      }).then(async (user) => {
        await bcrypt
          .compare(req.body.currentPassword, user.password)
          .then((passwordMatch) => {
            if (!passwordMatch) {
              return res.status(400).send({
                error: 'Incorrect current password',
              });
            }
            return res.status(200).send({
              message: 'Correct Password, Password matches!',
              password: req.body.currentPassword,
            });
          })
          .catch((error) => {
            res.status(500).send(error);
          });
      });
    } catch (err) {
      res.status(500).send(err);
    }
  };

  const toggleInvisibility = async function (req, res) {
    const { userId } = req.params;
    const { isVisible } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).send({
        error: 'Bad Request',
      });
      return;
    }
    if (!(await hasPermission(req.body.requestor, 'toggleInvisibility'))) {
      res.status(403).send('You are not authorized to change user visibility');
      return;
    }

    cache.removeCache(`user-${userId}`);
    UserProfile.findByIdAndUpdate(userId, { $set: { isVisible } }, (err) => {
      if (err) {
        return res.status(500).send(`Could not Find user with id ${userId}`);
      }
      // Check if there's a cache for all users and update it accordingly
      const isUserInCache = cache.hasCache('allusers');
      if (isUserInCache) {
        const allUserData = JSON.parse(cache.getCache('allusers'));
        const userIdx = allUserData.findIndex((users) => users._id === userId);
        const userData = allUserData[userIdx];
        userData.isVisible = isVisible;
        allUserData.splice(userIdx, 1, userData);
        cache.setCache('allusers', JSON.stringify(allUserData));
      }

      return res.status(200).send({
        message: 'User visibility updated successfully',
        isVisible,
      });
    });
  };

  const addInfringements = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'addInfringements'))) {
      res.status(403).send('You are not authorized to add blue square');
      return;
    }

    const userid = req.params.userId;

    cache.removeCache(`user-${userid}`);

    if (req.body.blueSquare === undefined) {
      res.status(400).send('Invalid Data');
      return;
    }

    UserProfile.findById(userid, async (err, record) => {
      if (err || !record) {
        res.status(404).send('No valid records found');
        return;
      }
      const inputDate = req.body.blueSquare.date;
      const isValidDate = moment(inputDate, moment.ISO_8601, true).isValid();
      if (!isValidDate) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      const newInfringement = {
        ...req.body.blueSquare,
        date: inputDate,

        // Handle reason - default to 'missingHours' if not provided
        reason: [
          'missingHours',
          'missingTimeEntry',
          'missingSummary',
          'vacationTime',
          'other',
        ].includes(req.body.blueSquare.reason)
          ? req.body.blueSquare.reason
          : 'missingHours',
        // Maintain backward compatibility
      };

      // find userData in cache
      const isUserInCache = cache.hasCache('allusers');
      let allUserData;
      let userData;
      let userIdx;
      if (isUserInCache) {
        allUserData = JSON.parse(cache.getCache('allusers'));
        userIdx = allUserData.findIndex((users) => users._id === userid);
        userData = allUserData[userIdx];
      }

      const originalinfringements = record?.infringements ?? [];
      // record.infringements = originalinfringements.concat(req.body.blueSquare);
      record.infringements = originalinfringements.concat(newInfringement);
      record.infringementCount += 1;

      console.log('Original infringements:', originalinfringements);
      console.log('Record infringements:', record.infringements);

      record
        .save()
        .then(async (results) => {
          await userHelper.notifyInfringements(
            originalinfringements,
            results.infringements,
            results.firstName,
            results.lastName,
            results.email,
            results.role,
            results.startDate,
            results.jobTitle[0],
            results.weeklycommittedHours,
          );
          res.status(200).json({
            _id: record._id,
            infringements: record.infringements,
          });

          // update alluser cache if we have cache
          if (isUserInCache) {
            allUserData.splice(userIdx, 1, userData);
            cache.setCache('allusers', JSON.stringify(allUserData));
          }
        })
        .catch((error) => res.status(400).send(error));
    });
  };

  const editInfringements = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'editInfringements'))) {
      res.status(403).send('You are not authorized to edit blue square');
      return;
    }
    const { userId, blueSquareId } = req.params;
    const { dateStamp, summary, reasons } = req.body;

    UserProfile.findById(userId, async (err, record) => {
      if (err || !record) {
        res.status(404).send('No valid records found');
        return;
      }

      const originalinfringements = record?.infringements ?? [];

      record.infringements = originalinfringements.map((blueSquare) => {
        if (blueSquare._id.equals(blueSquareId)) {
          blueSquare.date = dateStamp ?? blueSquare.date;
          blueSquare.description = summary ?? blueSquare.description;
          if (Array.isArray(reasons)) {
            blueSquare.reasons = reasons;
          }
        }
        return blueSquare;
      });

      record
        .save()
        .then(async (results) => {
          await userHelper.notifyInfringements(
            originalinfringements,
            results.infringements,
            results.firstName,
            results.lastName,
            results.email,
            results.role,
            results.startDate,
            results.jobTitle[0],
            results.weeklycommittedHours,
          );
          res.status(200).json({
            _id: record._id,
          });
        })
        .catch((error) => res.status(400).send(error));
    });
  };

  const deleteInfringements = async function (req, res) {
    try {
      if (!(await hasPermission(req.body.requestor, 'deleteInfringements'))) {
        return res.status(403).send('You are not authorized to delete blue square');
      }

      const { userId } = req.params;
      const blueSquareId = req.params.blueSquareId || req.params.infringementId || req.params.id;

      if (!userId || !blueSquareId) {
        return res.status(400).send('Missing userId or blueSquareId');
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).send(`Invalid userId: ${userId}`);
      }
      if (!mongoose.Types.ObjectId.isValid(blueSquareId)) {
        return res.status(400).send(`Invalid blueSquareId: ${blueSquareId}`);
      }

      const updated = await UserProfile.findOneAndUpdate(
        { _id: userId },
        {
          $pull: {
            infringements: { _id: blueSquareId },
            oldInfringements: { _id: blueSquareId },
          },
        },
        { new: true },
      );

      if (!updated) {
        return res.status(404).send('No valid records found');
      }

      const stillThere =
        (updated.infringements || []).some((x) => String(x._id) === String(blueSquareId)) ||
        (updated.oldInfringements || []).some((x) => String(x._id) === String(blueSquareId));

      if (stillThere) {
        return res.status(500).send('Delete did not persist (still present after update)');
      }

      updated.infringementCount = Math.max(0, (updated.infringements || []).length);
      await updated.save();

      return res.status(200).json({ _id: updated._id, deleted: blueSquareId });
    } catch (error) {
      return res.status(500).json({
        message: error?.message || 'Unknown error',
        name: error?.name,
      });
    }
  };

  const getProjectsByPerson = async function (req, res) {
    try {
      const { name } = req.params;
      const match = name.trim().split(' ');
      const firstName = match[0];
      const lastName = match[match.length - 1];

      const query = match[1]
        ? {
            $or: [
              {
                firstName: { $regex: new RegExp(`${escapeRegExp(name)}`, 'i') },
              },
              {
                $and: [
                  { firstName: { $regex: new RegExp(`${escapeRegExp(firstName)}`, 'i') } },
                  { lastName: { $regex: new RegExp(`${escapeRegExp(lastName)}`, 'i') } },
                ],
              },
            ],
          }
        : {
            $or: [
              {
                firstName: { $regex: new RegExp(`${escapeRegExp(name)}`, 'i') },
              },
              {
                lastName: { $regex: new RegExp(`${escapeRegExp(name)}`, 'i') },
              },
            ],
          };

      const userProfile = await UserProfile.find(query);

      if (userProfile) {
        const allProjects = userProfile
          .map((user) => user.projects)
          .filter((projects) => projects.length > 0)
          .flat();

        if (allProjects.length === 0) {
          return res.status(400).send({ message: 'Projects not found' });
        }

        return res.status(200).send({ message: 'Found profile and related projects', allProjects });
      }
    } catch (error) {
      return res.status(500).send({ massage: 'Encountered an error, please try again!' });
    }
  };

  const getAllTeamCodeHelper = async function (includePRTeams = false) {
    try {
      let distinctTeamCodes = await UserProfile.distinct('teamCode', {
        teamCode: { $ne: null },
      });

      distinctTeamCodes = distinctTeamCodes
        .map((code) => (code ? code.trim().toUpperCase() : ''))
        .filter((code) => code !== '');

      if (includePRTeams) {
        let prInsightsTeamCodes = [];
        try {
          prInsightsTeamCodes = await PRReviewInsights.distinct('teamCode', {
            teamCode: { $ne: null },
          });
          prInsightsTeamCodes = prInsightsTeamCodes.filter((code) => code && code.trim() !== '');
        } catch (error) {
          console.error('Error fetching PR insights team codes:', error);
        }

        const allTeamCodes = [...new Set([...distinctTeamCodes, ...prInsightsTeamCodes])];
        allTeamCodes.sort();

        try {
          cache.removeCache('teamCodes');
          cache.setCache('teamCodes', JSON.stringify(allTeamCodes));
        } catch (error) {
          console.error('Error caching team codes:', error);
        }

        return allTeamCodes;
      }

      try {
        cache.removeCache('teamCodes');
        cache.setCache('teamCodes', JSON.stringify(distinctTeamCodes));
      } catch (error) {
        console.error('Error caching team codes:', error);
      }

      return distinctTeamCodes;
    } catch (error) {
      throw new Error('Encountered an error to get all team codes, please try again!');
    }
  };

  // const getAllTeamCodeHelper = async function () {
  //   let distinctTeamCodes = await UserProfile.distinct("teamCode", {
  //     teamCode: { $ne: null },
  //   });
  //   distinctTeamCodes = distinctTeamCodes.filter((code) => code && code.trim() !== "");
  //   console.log("Team codes found:", distinctTeamCodes);
  //   return distinctTeamCodes;
  // };

  const getAllTeamCode = async function (req, res) {
    try {
      // Check if includePRTeams query parameter is set to 'true'
      const includePRTeams = req.query.includePRTeams === 'true';
      const distinctTeamCodes = await getAllTeamCodeHelper(includePRTeams);
      return res.status(200).send({ message: 'Found', distinctTeamCodes });
    } catch (error) {
      return res
        .status(500)
        .send({ message: 'Encountered an error to get all team codes, please try again!' });
    }
  };

  const removeProfileImage = async (req, res) => {
    try {
      /* eslint-disable camelcase */
      const { user_id } = req.body;
      await UserProfile.updateOne({ _id: user_id }, { $unset: { profilePic: '' } });
      cache.removeCache(`user-${user_id}`);
      return res.status(200).send({ message: 'Image Removed' });
    } catch (err) {
      return res.status(404).send({ message: 'Error Removing Image' });
    }
  };
  const updateProfileImageFromWebsite = async (req, res) => {
    try {
      const user = req.body;
      await UserProfile.updateOne(
        { _id: user.user_id },
        {
          $set: { profilePic: user.selectedImage },
          $unset: { suggestedProfilePics: '' },
        },
      );
      cache.removeCache(`user-${user.user_id}`);
      return res.status(200).send({ message: 'Profile Updated' });
    } catch (err) {
      return res.status(404).send({ message: 'Profile Update Failed' });
    }
  };

  const getUserByAutocomplete = (req, res) => {
    const { searchText } = req.params;

    if (!searchText) {
      return res.status(400).send({ message: 'Search text is required' });
    }

    const regex = new RegExp(searchText, 'i'); // Case-insensitive regex for partial matching

    UserProfile.find(
      {
        $or: [
          { firstName: { $regex: regex } },
          { lastName: { $regex: regex } },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$firstName', ' ', '$lastName'] },
                regex: searchText,
                options: 'i',
              },
            },
          },
        ],
      },
      '_id firstName lastName', // Projection to limit fields returned
    )
      .limit(SEARCH_RESULT_LIMIT) // Limit results for performance
      .then((results) => {
        res.status(200).send(results);
      })
      .catch(() => {
        res.status(500).send({ error: 'Internal Server Error' });
      });
  };

  const updateUserInformation = async function (req, res) {
    try {
      const data = req.body;

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).send({ error: 'No updates provided' });
      }

      const ops = data.map(({ user_id, item, value }) => ({
        updateOne: {
          filter: { _id: user_id },
          update: { $set: { [item]: value } },
        },
      }));

      await UserProfile.bulkWrite(ops);

      return res.status(200).send({ message: 'Update successful' });
    } catch (error) {
      console.error('Error updating user information:', error);
      return res.status(500).send({ error: 'Internal server error' });
    }
  };

  const getAllMembersSkillsAndContact = async function (req, res) {
    try {
      if (!req.body.requestor || !req.body.requestor.requestorId) {
        return res.status(401).send({ message: 'User not authenticated' });
      }

      const userId = req.body.requestor.requestorId;

      const skillName = req.params.skill;
      if (!skillName) {
        return res.status(400).send({ message: 'Skill parameter is required' });
      }

      // Get all form responses except for the current user
      const formResponses = await HGNFormResponses.find({
        user_id: { $ne: userId }, // Exclude current user
      }).lean();

      // Get user IDs from form responses
      const userIds = formResponses.map((response) => response.user_id);

      // Get user profiles to get privacy settings
      const userProfiles = await UserProfile.find({
        _id: { $in: userIds },
      })
        .select('_id email phoneNumber privacySettings')
        .lean();

      // Create a map of user profiles by ID for faster lookup
      const profileMap = userProfiles.reduce((map, profile) => {
        map[profile._id.toString()] = profile;
        return map;
      }, {});

      // Map data with privacy considerations
      const membersData = formResponses
        .map((response) => {
          const profile = profileMap[response.user_id];

          if (!profile) {
            return null;
          }

          let score = 0;

          // Check for skill score in frontend or backend
          if (response.frontend && response.frontend[skillName] !== undefined) {
            score = parseInt(response.frontend[skillName], 10) || 0;
          } else if (response.backend && response.backend[skillName] !== undefined) {
            score = parseInt(response.backend[skillName], 10) || 0;
          }

          // Apply privacy settings
          const email = profile.privacySettings?.email === false ? null : profile.email;

          // Get phone number with privacy consideration
          let phoneNumber = null;
          if (profile.privacySettings?.phoneNumber !== false) {
            if (profile.phoneNumber && profile.phoneNumber.length > 0) {
              const [firstPhoneNumber] = profile.phoneNumber;
              phoneNumber = firstPhoneNumber;
            }
          }

          return {
            name: response.userInfo.name,
            email,
            phoneNumber,
            slack: response.userInfo.slack,
            rating: `${score} / 10`,
          };
        })
        .filter((item) => item !== null);

      // Sort by skill score (highest first)
      const sortedData = [...membersData].sort((a, b) => {
        const scoreA = parseInt(a.rating.split(' / ')[0], 10);
        const scoreB = parseInt(b.rating.split(' / ')[0], 10);
        return scoreB - scoreA;
      });

      return res.status(200).send(sortedData);
    } catch (error) {
      console.error('Error in getAllMembersSkillsAndContact:', error);
      return res.status(500).send({
        message: 'Failed to retrieve members',
        error: error.message,
      });
    }
  };

  const replaceTeamCodeForUsers = async (req, res) => {
    const { oldTeamCodes, newTeamCode, warningUsers } = req.body;

    // Validate input
    if (!Array.isArray(oldTeamCodes) || oldTeamCodes.length === 0 || !newTeamCode) {
      console.error('Validation Failed:', { oldTeamCodes, newTeamCode });
      return res.status(400).send({
        error: 'Invalid input. Provide oldTeamCodes as an array and a valid newTeamCode.',
      });
    }

    try {
      // Sanitize oldTeamCodes to ensure they are strings
      const sanitizedOldTeamCodes = oldTeamCodes.map((code) => String(code).trim());

      // 1. Find all matching users first
      const usersToUpdate = await UserProfile.find({ teamCode: { $in: sanitizedOldTeamCodes } });

      if (usersToUpdate.length === 0) {
        return res.status(404).send({ error: 'No users found with the specified team codes.' });
      }

      const updatedUsersInfo = await Promise.all(
        usersToUpdate.map(async (user) => {
          user.teamCode = newTeamCode;
          let { teamCodeWarning } = user;

          if (warningUsers && warningUsers.includes(user._id.toString())) {
            teamCodeWarning = await userHelper.checkTeamCodeMismatch(user);
          }

          return {
            updateOne: {
              filter: { _id: user._id },
              update: {
                $set: {
                  teamCode: newTeamCode,
                  teamCodeWarning,
                },
              },
            },
            userInfo: {
              userId: user._id,
              teamCodeWarning,
            },
          };
        }),
      );

      // Then split into bulkOps and result set
      const bulkOps = updatedUsersInfo.map((x) => ({ updateOne: x.updateOne }));

      // 2. Execute all updates at once
      if (bulkOps.length > 0) {
        await UserProfile.bulkWrite(bulkOps);
      }

      return res.status(200).send({
        message: 'Team codes updated successfully.',
        updatedUsers: updatedUsersInfo,
      });
    } catch (error) {
      console.error('Error updating team codes:', error);
      return res.status(500).send({ error: 'An error occurred while updating team codes.' });
    }
  };

  const getUserSkillRadarData = async function (req, res) {
    try {
      const { userId } = req.params;
      const section = (req.query.section || 'all').toLowerCase(); // 'frontend' | 'backend' | 'all'
      if (!userId) return res.status(400).send({ error: 'Missing userId parameter' });

      const projection = { frontend: 1, backend: 1, 'followUp.user_id': 1, user_id: 1 };
      let response = await HGNFormResponses.findOne(
        { 'followUp.user_id': userId },
        projection,
      ).lean();
      if (!response)
        response = await HGNFormResponses.findOne({ user_id: userId }, projection).lean();
      if (!response) response = await HGNFormResponses.findOne({ _id: userId }, projection).lean();

      if (!response) return res.status(404).send({ error: 'No skill data found for this user' });

      const toNum = (v) => {
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      const toItems = (obj) =>
        Object.entries(obj || {})
          .filter(([k]) => !/^overall$/i.test(k)) // drop 'overall'
          .map(([name, score]) => ({ name, score: toNum(score) }));

      const fe = toItems(response.frontend);
      const be = toItems(response.backend);

      let skills;
      if (section === 'frontend') skills = fe;
      else if (section === 'backend') skills = be;
      else skills = [...fe, ...be];

      return res.status(200).json({
        userId,
        section,
        maxScore: 10,
        skills,
      });
    } catch (error) {
      console.error('Error fetching skill data:', error);
      return res.status(500).send({ error: error.message });
    }
  };

  return {
    searchUsersByName,
    postUserProfile,
    getUserProfiles,
    putUserProfile,
    toggleUserBioPosted,
    deleteUserProfile,
    getUserById,
    getreportees,
    updateOneProperty,
    updateAllMembersTeamCode,
    updatepassword,
    getUserName,
    getTeamMembersofUser,
    getProjectMembers,
    changeUserStatus,
    resetPassword,
    getUserByName,
    getAllUsersWithFacebookLink,
    refreshToken,
    getUserBySingleName,
    getUserByFullName,
    changeUserRehireableStatus,
    authorizeUser,
    toggleInvisibility,
    addInfringements,
    editInfringements,
    deleteInfringements,
    getProjectsByPerson,
    getAllTeamCode,
    getAllTeamCodeHelper,
    removeProfileImage,
    updateProfileImageFromWebsite,
    getUserByAutocomplete,
    getUserProfileBasicInfo,
    updateUserInformation,
    getAllMembersSkillsAndContact,
    replaceTeamCodeForUsers,
    getUserSkillRadarData,
  };
};

const userProfileController = function (UserProfile, Project) {
  const cache = cacheClosure();
  return createControllerMethods(UserProfile, Project, cache);
};

module.exports = userProfileController;
