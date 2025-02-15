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
const yearMonthDayDateValidator = require('../utilities/yearMonthDayDateValidator');
const cacheClosure = require('../utilities/nodeCache');
const followUp = require('../models/followUp');
const userService = require('../services/userService');
// const { authorizedUserSara, authorizedUserJae } = process.env;
const authorizedUserSara = `nathaliaowner@gmail.com`; // To test this code please include your email here
const authorizedUserJae = `jae@onecommunityglobal.org`;
const logUserPermissionChangeByAccount = require('../utilities/logUserPermissionChangeByAccount');

const { hasPermission, canRequestorUpdateUser } = require('../utilities/permissions');
const helper = require('../utilities/permissions');

const escapeRegex = require('../utilities/escapeRegex');
const emailSender = require('../utilities/emailSender');
const objectUtils = require('../utilities/objectUtils');

const config = require('../config');
const { PROTECTED_EMAIL_ACCOUNT } = require('../utilities/constants');

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
  // Verify request is authorized by self or adminsitrator
  if (
    userId !== requestor.requestorId &&
    !(await hasPermission(req.body.requestor, 'updatePassword'))
  ) {
    res.status(403).send({
      error: "You are unauthorized to update this user's password",
    });
    return;
  }

  // Verify request is authorized by self or adminsitrator
  if (
    userId === requestor.requestorId ||
    !(await hasPermission(req.body.requestor, 'updatePassword'))
  ) {
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

const sendEmailUponProtectedAccountUpdate = (
  requestorEmail,
  requestorFullName,
  targetEmail,
  action,
  logId,
) => {
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

const auditIfProtectedAccountUpdated = async (
  requestorId,
  updatedRecordEmail,
  originalRecord,
  updatedRecord,
  updateDiffPaths,
  actionPerformed,
) => {
  if (PROTECTED_EMAIL_ACCOUNT.includes(updatedRecordEmail)) {
    const requestorProfile = await userService.getUserFullNameAndEmailById(requestorId);
    const requestorFullName = requestorProfile
      ? requestorProfile.firstName.concat(' ', requestorProfile.lastName)
      : 'N/A';
    // remove sensitive data from the original and updated records
    let extraData = null;
    const updateObject = updatedRecord.toObject();
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

    sendEmailUponProtectedAccountUpdate(
      requestorProfile?.email,
      requestorFullName,
      updatedRecordEmail,
      actionPerformed,
      logId,
    );
  }
};

const userProfileController = function (UserProfile, Project) {
  const cache = cacheClosure();

  const forbidden = function (res, message) {
    res.status(403).send(message);
  };

  const checkPermission = async function (req, permission) {
    return helper.hasPermission(req.body.requestor, permission);
  };

  const getUserProfiles = async function (req, res) {
    if (!(await checkPermission(req, 'getUserProfiles'))) {
      forbidden(res, 'You are not authorized to view all users');
      return;
    }

    await UserProfile.find(
      {},
      '_id firstName lastName role weeklycommittedHours jobTitle email permissions isActive reactivationDate startDate createdDate endDate',
    )
      .sort({
        lastName: 1,
      })
      .then((results) => {
        if (!results) {
          if (cache.getCache('allusers')) {
            const getData = JSON.parse(cache.getCache('allusers'));
            res.status(200).send(getData);
            return;
          }
          res.status(500).send({ error: 'User result was invalid' });
          return;
        }
        const transformedResults = results.map(user => ({
          ...user.toObject(),
          jobTitle: Array.isArray(user.jobTitle) ? user.jobTitle.join(', ') : user.jobTitle,
        }));
        console.log(transformedResults);
        cache.setCache('allusers', JSON.stringify(transformedResults));
        res.status(200).send(transformedResults);
      })
      .catch((error) => res.status(404).send(error));
  };

  /**
   * Controller function to retrieve basic user profile information.
   * This endpoint checks if the user has the necessary permissions to access user profiles.
   * If authorized, it queries the database to fetch only the required fields:
   * _id, firstName, lastName, isActive, startDate, and endDate, sorted by last name.
   */
  const getUserProfileBasicInfo = async function (req, res) {
    if (!(await checkPermission(req, 'getUserProfiles'))) {
      forbidden(res, 'You are not authorized to view all users');
      return;
    }

    await UserProfile.find({}, '_id firstName lastName isActive startDate createdDate endDate')
      .sort({
        lastName: 1,
      })
      .then((results) => {
        if (!results) {
          if (cache.getCache('allusers')) {
            const getData = JSON.parse(cache.getCache('allusers'));
            res.status(200).send(getData);
            return;
          }
          res.status(500).send({ error: 'User result was invalid' });
          return;
        }
        cache.setCache('allusers', JSON.stringify(results));
        res.status(200).send(results);
      })
      .catch((error) => res.status(404).send(error));
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

  const postUserProfile = async function (req, res) {
    if (!(await checkPermission(req, 'postUserProfile'))) {
      forbidden(res, 'You are not authorized to create new users');
      return;
    }

    if (req.body.role === 'Owner' && !(await checkPermission(req, 'addDeleteEditOwners'))) {
      forbidden(res, 'You are not authorized to create new owners');
      return;
    }

    const userByEmail = await UserProfile.findOne({
      email: {
        $regex: escapeRegex(req.body.email),
        $options: 'i',
      },
    });

    if (userByEmail) {
      res.status(400).send({
        error: 'That email address is already in use. Please choose another email address.',
        type: 'email',
      });
      return;
    }

    // In dev environment, if newly created user is Owner or Administrator, make fetch request to Beta login route with actualEmail and actual Password
    if (process.env.dbName === 'hgnData_dev') {
      if (req.body.role === 'Owner' || req.body.role === 'Administrator') {
        const email = req.body.actualEmail;
        const password = req.body.actualPassword;
        const url = 'https://hgn-rest-beta.azurewebsites.net/api/';
        try {
          // Log in to Beta login route using provided credentials
          const response = await fetch(`${url}login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
          if (!response.ok) {
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

    /** *
     *  Turn on and off the duplicate phone number checker by changing
     *  the value of duplicatePhoneNumberCheck variable.
     */
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

    // create new user
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

    try {
      const requestor = await UserProfile.findById(req.body.requestor.requestorId)
        .select('firstName lastName email role')
        .exec();

      await up.save().then(() => {
        // if connected to dev db just check for Owner roles, else it's main branch so also check admin too
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
      });

      // update backend cache if it exists
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

      res.status(200).send({
        _id: up._id,
      });
    } catch (error) {
      res.status(501).send(error);
    }
  };

  const putUserProfile = async function (req, res) {
    const userid = req.params.userId;
    const canEditProtectedAccount = await canRequestorUpdateUser(
      req.body.requestor.requestorId,
      userid,
    );

    const isRequestorAuthorized = !!(
      canEditProtectedAccount &&
      ((await hasPermission(req.body.requestor, 'putUserProfile')) ||
        req.body.requestor.requestorId === userid)
    );

    const canManageAdminLinks = await hasPermission(req.body.requestor, 'manageAdminLinks');

    if (!isRequestorAuthorized && !canManageAdminLinks) {
      res.status(403).send('You are not authorized to update this user');
      return;
    }

    if (
      req.body.role === 'Owner' &&
      !(await hasPermission(req.body.requestor, 'addDeleteEditOwners'))
    ) {
      res.status(403).send('You are not authorized to update this user');
      return;
    }

    cache.removeCache(`user-${userid}`);
    UserProfile.findById(userid, async (err, record) => {
      if (err || !record) {
        res.status(404).send('No valid records found');
        return;
      }

      // To keep a copy of the original record if we edit the protected account
      let originalRecord = {};
      if (PROTECTED_EMAIL_ACCOUNT.includes(record.email)) {
        originalRecord = objectUtils.deepCopyMongooseObjectWithLodash(record);
      }
      // validate userprofile pic

      if (req.body.profilePic) {
        const results = userHelper.validateProfilePic(req.body.profilePic);

        if (!results.result) {
          res.status(400).json(results.errors);
          return;
        }
      }

      const canEditTeamCode =
        req.body.requestor.role === 'Owner' ||
        req.body.requestor.role === 'Administrator' ||
        req.body.requestor.permissions?.frontPermissions.includes('editTeamCode');

      if (!canEditTeamCode && record.teamCode !== req.body.teamCode) {
        res.status(403).send('You are not authorized to edit team code.');
        return;
      }

      const originalinfringements = record.infringements ? record.infringements : [];

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
      ];

      commonFields.forEach((fieldName) => {
        if (req.body[fieldName] !== undefined) {
          record[fieldName] = req.body[fieldName];
        }
      });

      // Since we leverage cache for all team code retrival (refer func getAllTeamCode()),
      // we need to remove the cache when team code is updated in case of new team code generation
      if (req.body.teamCode) {
        // remove teamCode cache when new team assigned
        if (req.body.teamCode !== record.teamCode) {
          cache.removeCache('teamCodes');
        }
        record.teamCode = req.body.teamCode;
      }

      record.lastModifiedDate = Date.now();

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
      if (await hasPermission(req.body.requestor, 'updateSummaryRequirements')) {
        const summaryFields = ['weeklySummaryNotReq', 'weeklySummaryOption'];
        summaryFields.forEach((fieldName) => {
          if (req.body[fieldName] !== undefined) {
            record[fieldName] = req.body[fieldName];
          }
        });
      }

      if (req.body.adminLinks !== undefined && canManageAdminLinks) {
        record.adminLinks = req.body.adminLinks;
      }

      if (await hasPermission(req.body.requestor, 'putUserProfileImportantInfo')) {
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
          switch (req.body.role) {
            case 'Mentor':
              record.isVisible = false;
              break;
            default:
              record.isVisible = true;
          }
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

        if (req.body.projects !== undefined) {
          const newProjects = req.body.projects.map((project) => project._id.toString());

          // check if the projects have changed
          const projectsChanged =
            !record.projects.every((id) => newProjects.includes(id.toString())) ||
            !newProjects.every((id) => record.projects.map((p) => p.toString()).includes(id));

          if (projectsChanged) {
            // store the old projects for comparison
            const oldProjects = record.projects.map((id) => id.toString());

            // update the projects
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
        }

        if (req.body.email !== undefined) {
          record.email = req.body.email.toLowerCase();
        }

        // Logic to update weeklycommittedHours and the history of the committed hours made
        if (
          req.body.weeklycommittedHours !== undefined &&
          record.weeklycommittedHours !== req.body.weeklycommittedHours
        ) {
          record.weeklycommittedHours = req.body.weeklycommittedHours;

          // If their last update was made today, remove that
          const lasti = record.weeklycommittedHoursHistory.length - 1;
          const lastChangeDate = moment(record.weeklycommittedHoursHistory[lasti].dateChanged);
          const now = moment();

          if (lastChangeDate.isSame(now, 'day')) {
            record.weeklycommittedHoursHistory.pop();
          }

          // Add the new committed hours with current date to history
          // from this date onward user will commit this much hours
          const newEntry = {
            hours: record.weeklycommittedHours,
            dateChanged: Date.now(),
          };
          record.weeklycommittedHoursHistory.push(newEntry);
        }

        if (req.body.startDate !== undefined && record.startDate !== req.body.startDate) {
          record.startDate = moment.tz(req.body.startDate, 'America/Los_Angeles').toDate();
          // Make sure weeklycommittedHoursHistory isn't empty
          if (record.weeklycommittedHoursHistory.length === 0) {
            const newEntry = {
              hours: record.weeklycommittedHours,
              dateChanged: Date.now(),
            };
            record.weeklycommittedHoursHistory.push(newEntry);
          }
          // then also change the first committed history (index 0)

          record.weeklycommittedHoursHistory[0].dateChanged = record.startDate;
        }

        if (
          req.body.permissions !== undefined &&
          (await hasPermission(req.body.requestor, 'putUserProfilePermissions'))
        ) {
          record.permissions = req.body.permissions;
          await logUserPermissionChangeByAccount(req);
        }

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
      }

      let updatedDiff = null;
      if (PROTECTED_EMAIL_ACCOUNT.includes(record.email)) {
        updatedDiff = record.modifiedPaths();
      }
      if (req.body.role === 'Administrator') {
        record.permissions.frontPermissions.push('updateTask');
      }
      record
        .save()
        .then((results) => {
          userHelper.notifyInfringements(
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

          // update alluser cache if we have cache
          if (isUserInCache) {
            allUserData.splice(userIdx, 1, userData);
            cache.setCache('allusers', JSON.stringify(allUserData));
          }
          // Log the update of a protected email account
          auditIfProtectedAccountUpdated(
            req.body.requestor.requestorId,
            originalRecord.email,
            originalRecord,
            record,
            updatedDiff,
            'update',
          );
        })
        .catch((error) => {
          if (error.name === 'ValidationError' && error.errors.lastName) {
            const errors = Object.values(error.errors).map((er) => er.message);
            return res.status(400).json({
              message: 'Validation Error',
              error: errors,
            });
          }
          console.error('Failed to save record:', error);
          return res.status(400).json({ error: 'Failed to save record.' });
        });
    });
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
      const timeArchiveUser = await UserProfile.findOne(
        {
          firstName: process.env.TIME_ARCHIVE_FIRST_NAME,
          lastName: process.env.TIME_ARCHIVE_LAST_NAME,
        },
        '_id',
      );

      if (!timeArchiveUser) {
        logger.logException('Time Archive user was not found. Please check the database');
        res.status(500).send({
          error:
            'Time Archive User not found. Please contact your developement team on why that happened',
        });
        return;
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
    }

    cache.removeCache(`user-${userId}`);
    if (cache.getCache('allusers')) {
      const allUserData = JSON.parse(cache.getCache('allusers'));
      const userIdx = allUserData.findIndex((users) => users._id === userId);
      allUserData.splice(userIdx, 1);
      cache.setCache('allusers', JSON.stringify(allUserData));
    }
    const originalRecord = objectUtils.deepCopyMongooseObjectWithLodash(user);
    try {
      await UserProfile.deleteOne({ _id: userId });
      // delete followUp for deleted user
      await followUp.findOneAndDelete({ userId });
      res.status(200).send({ message: 'Executed Successfully' });
      auditIfProtectedAccountUpdated(
        req.body.requestor.requestorId,
        originalRecord.email,
        originalRecord,
        null,
        'delete',
      );
    } catch (err) {
      res.status(500).send(err);
    }
  };

  const getUserById = function (req, res) {
    const userid = req.params.userId;
    // if (cache.getCache(`user-${userid}`)) {
    //   const getData = JSON.parse(cache.getCache(`user-${userid}`));
    //   res.status(200).send(getData);
    //   return;
    // }
    UserProfile.findById(userid, '-password -refreshTokens -lastModifiedDate -__v')
      .populate([
        {
          path: 'teams',
          select: '_id teamName',
          options: {
            sort: {
              teamName: 1,
            },
          },
        },
        {
          path: 'projects',
          select: '_id projectName category',
          options: {
            sort: {
              projectName: 1,
            },
          },
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
          path: 'infringements', // Populate infringements field
          select: 'date description',
          options: {
            sort: {
              date: -1, // Sort by date descending if needed
            },
          },
        },
      ])
      .exec()
      .then((results) => {
        if (!results) {
          res.status(400).send({ error: 'This is not a valid user' });
          return;
        }
        userHelper.getTangibleHoursReportedThisWeekByUserId(userid).then((hours) => {
          results.set('tangibleHoursReportedThisWeek', hours, {
            strict: false,
          });
          cache.setCache(`user-${userid}`, JSON.stringify(results));
          res.status(200).send(results);
        });
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

  const updateOneProperty = async function (req, res) {
    const { userId } = req.params;
    const { key, value } = req.body;

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

    if (key === 'teamCode') {
      const canEditTeamCode =
        req.body.requestor.role === 'Owner' ||
        req.body.requestor.role === 'Administrator' ||
        req.body.requestor.permissions?.frontPermissions.includes('editTeamCode');

      if (!canEditTeamCode) {
        res.status(403).send('You are not authorized to edit team code.');
        return;
      }
    }

    // remove user from cache, it should be loaded next time
    cache.removeCache(`user-${userId}`);
    if (!key || value === undefined) {
      return res.status(400).send({ error: 'Missing property or value' });
    }

    return UserProfile.findById(userId)
      .then((user) => {
        let originalRecord = null;
        if (PROTECTED_EMAIL_ACCOUNT.includes(user.email)) {
          originalRecord = objectUtils.deepCopyMongooseObjectWithLodash(user);
        }
        user.set({
          [key]: value,
        });
        let updatedDiff = null;
        if (PROTECTED_EMAIL_ACCOUNT.includes(user.email)) {
          updatedDiff = user.modifiedPaths();
        }
        return user
          .save()
          .then(() => {
            res.status(200).send({ message: 'updated property' });
            auditIfProtectedAccountUpdated(
              req.body.requestor.requestorId,
              originalRecord.email,
              originalRecord,
              user,
              updatedDiff,
              'update',
            );
          })
          .catch((error) => res.status(500).send(error));
      })
      .catch((error) => res.status(500).send(error));
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
                auditIfProtectedAccountUpdated(
                  req.body.requestor.requestorId,
                  user.email,
                  null,
                  null,
                  'PasswordUpdate',
                );
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

  const changeUserStatus = async function (req, res) {
    const { userId } = req.params;
    const status = req.body.status === 'Active';
    const activationDate = req.body.reactivationDate;
    const { endDate } = req.body;
    const isSet = req.body.isSet === 'FinalDay';
    let activeStatus = status;
    let emailThreeWeeksSent = false;
    if (endDate && status) {
      const dateObject = new Date(endDate);
      dateObject.setHours(dateObject.getHours() + 7);
      const setEndDate = dateObject;
      if (moment().isAfter(moment(setEndDate).add(1, 'days'))) {
        activeStatus = false;
      } else if (moment().isBefore(moment(endDate).subtract(3, 'weeks'))) {
        emailThreeWeeksSent = true;
      }
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).send({
        error: 'Bad Request',
      });
      return;
    }

    const canEditProtectedAccount = await canRequestorUpdateUser(
      req.body.requestor.requestorId,
      userId,
    );

    if (
      !((await hasPermission(req.body.requestor, 'changeUserStatus')) && canEditProtectedAccount)
    ) {
      if (PROTECTED_EMAIL_ACCOUNT.includes(req.body.requestor.email)) {
        logger.logInfo(
          `Unauthorized attempt to change protected user status. Requestor: ${req.body.requestor.requestorId} Target: ${userId}`,
        );
      }
      res.status(403).send('You are not authorized to change user status');
      return;
    }
    cache.removeCache(`user-${userId}`);
    const emailReceivers = await UserProfile.find(
      { isActive: true, role: { $in: ['Owner'] } },
      '_id isActive role email',
    );

    const recipients = emailReceivers.map((receiver) => receiver.email);

    try {
      const findUser = await UserProfile.findById(userId, 'teams');
      findUser.teams.map(async (teamId) => {
        const managementEmails = await userHelper.getTeamManagementEmail(teamId);
        if (Array.isArray(managementEmails) && managementEmails.length > 0) {
          managementEmails.forEach((management) => {
            recipients.push(management.email);
          });
        }
      });
    } catch (err) {
      logger.logException(err, 'Unexpected error in finding menagement team');
    }

    UserProfile.findById(userId, 'isActive email firstName lastName finalEmailThreeWeeksSent')
      .then((user) => {
        user.set({
          isActive: activeStatus,
          reactivationDate: activationDate,
          endDate,
          isSet,
          finalEmailThreeWeeksSent: emailThreeWeeksSent,
        });
        user
          .save()
          .then(() => {
            const isUserInCache = cache.hasCache('allusers');
            if (isUserInCache) {
              const allUserData = JSON.parse(cache.getCache('allusers'));
              const userIdx = allUserData.findIndex((users) => users._id === userId);
              const userData = allUserData[userIdx];
              if (!status) {
                userData.endDate = user.endDate.toISOString();
              }
              userData.isActive = user.isActive;
              allUserData.splice(userIdx, 1, userData);
              cache.setCache('allusers', JSON.stringify(allUserData));
            }
            userHelper.sendDeactivateEmailBody(
              user.firstName,
              user.lastName,
              endDate,
              user.email,
              recipients,
              isSet,
              activationDate,
              emailThreeWeeksSent,
            );
            auditIfProtectedAccountUpdated(
              req.body.requestor.requestorId,
              user.email,
              null,
              null,
              'UserStatusUpdate',
            );
            res.status(200).send({
              message: 'status updated',
            });
          })
          .catch((error) => {
            res.status(500).send(error);
          });
      })
      .catch((error) => {
        res.status(500).send(error);
      });
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
          auditIfProtectedAccountUpdated(
            req.body.requestor.requestorId,
            verifiedUser.email,
            null,
            null,
            'UserRehireableStatusUpdate',
          );
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
      ValidatePassword(req);

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

      if (!(await hasPermission(requestor, 'putUserProfileImportantInfo'))) {
        res.status(403).send('You are not authorized to reset this users password');
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
      auditIfProtectedAccountUpdated(
        req.body.requestor.requestorId,
        user.email,
        null,
        null,
        'UserResetPassword',
      );
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
      expiryTimestamp: moment_().add(config.TOKEN.Lifetime, config.TOKEN.Units),
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
    UserProfile.findByIdAndUpdate(userId, { $set: { isVisible } }, (err, _) => {
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
    })}
    
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
      record.infringements = originalinfringements.concat(req.body.blueSquare);

      record
        .save()
        .then((results) => {
          userHelper.notifyInfringements(
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
    const { dateStamp, summary } = req.body;

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
        }
        return blueSquare;
      });

      record
        .save()
        .then((results) => {
          userHelper.notifyInfringements(
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
    if (!(await hasPermission(req.body.requestor, 'deleteInfringements'))) {
      res.status(403).send('You are not authorized to delete blue square');
      return;
    }
    const { userId, blueSquareId } = req.params;

    UserProfile.findById(userId, async (err, record) => {
      if (err || !record) {
        res.status(404).send('No valid records found');
        return;
      }

      const originalinfringements = record?.infringements ?? [];

      record.infringements = originalinfringements.filter(
        (infringement) => !infringement._id.equals(blueSquareId),
      );

      record
        .save()
        .then((results) => {
          userHelper.notifyInfringements(
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

  const getAllTeamCodeHelper = async function () {
    try {
      if (cache.hasCache('teamCodes')) {
        const teamCodes = JSON.parse(cache.getCache('teamCodes'));
        return teamCodes;
      }
      const distinctTeamCodes = await UserProfile.distinct('teamCode', {
        teamCode: { $ne: null },
      });
      cache.setCache('teamCodes', JSON.stringify(distinctTeamCodes));
      return distinctTeamCodes;
    } catch (error) {
      throw new Error('Encountered an error to get all team codes, please try again!');
    }
  };

  const getAllTeamCode = async function (req, res) {
    try {
      const distinctTeamCodes = await getAllTeamCodeHelper();
      return res.status(200).send({ message: 'Found', distinctTeamCodes });
    } catch (error) {
      return res
        .status(500)
        .send({ message: 'Encountered an error to get all team codes, please try again!' });
    }
  };
  
  const removeProfileImage = async (req,res) =>{
    try{
      var user_id=req.body.user_id
      await UserProfile.updateOne({_id:user_id},{$unset:{profilePic:""}})
      cache.removeCache(`user-${user_id}`);
      return res.status(200).send({message:'Image Removed'})
    }catch(err){
      console.log(err)
      return res.status(404).send({message:"Error Removing Image"})
    }
  }
  const updateProfileImageFromWebsite = async (req,res) =>{
    try{
      var user=req.body
      await UserProfile.updateOne({_id:user.user_id},
        {
          $set: { profilePic : user.selectedImage},
          $unset: { suggestedProfilePics: "" }
      })
      cache.removeCache(`user-${user.user_id}`);
      return res.status(200).send({message:"Profile Updated"})
    }catch(err){
      console.log(err)
      return res.status(404).send({message:"Profile Update Failed"})
    }
  }

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
      .limit(10) // Limit results for performance
      .then((results) => {
        res.status(200).send(results);
      })
      .catch(() => {
        res.status(500).send({ error: 'Internal Server Error' });
      });
  };

  const updateUserInformation = async function (req,res){
    try {
      const data=req.body;
      data.map(async (e)=>  {
        const result = await UserProfile.findById(e.user_id);
        result[e.item]=e.value
        await result.save();
      })
      res.status(200).send({ message: 'Update successful'});
    } catch (error) {
      console.log(error)
      return res.status(500)
    }
  };

  return {
    postUserProfile,
    getUserProfiles,
    putUserProfile,
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
  };
};

module.exports = userProfileController;
