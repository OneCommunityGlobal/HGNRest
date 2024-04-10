const moment = require('moment-timezone');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');

const moment_ = require('moment');
const jwt = require('jsonwebtoken');
const userHelper = require('../helpers/userHelper')();
const TimeEntry = require('../models/timeentry');
const logger = require('../startup/logger');
const Badge = require('../models/badge');
const yearMonthDayDateValidator = require('../utilities/yearMonthDayDateValidator');
const cache = require('../utilities/nodeCache')();

const { authorizedUserSara, authorizedUserJae } = process.env;

const {
  hasPermission,
  canRequestorUpdateUser,
} = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const config = require('../config');

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
    userId !== requestor.requestorId
    && !(await hasPermission(req.body.requestor, 'updatePassword'))
  ) {
    res.status(403).send({
      error: "You are unauthorized to update this user's password",
    });
    return;
  }

  // Verify request is authorized by self or adminsitrator
  if (
    userId === requestor.requestorId
    || !(await hasPermission(req.body.requestor, 'updatePassword'))
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

const userProfileController = function (UserProfile) {
  const getUserProfiles = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'getUserProfiles'))) {
      res.status(403).send('You are not authorized to view all users');
      return;
    }

    UserProfile.find(
      {},
      '_id firstName lastName role weeklycommittedHours email permissions isActive reactivationDate createdDate endDate',
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
    if (!(await hasPermission(req.body.requestor, 'postUserProfile'))) {
      res.status(403).send('You are not authorized to create new users');
      return;
    }

    if (
      req.body.role === 'Owner'
      && !(await hasPermission(req.body.requestor, 'addDeleteEditOwners'))
    ) {
      res.status(403).send('You are not authorized to create new owners');
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
        error:
          'That email address is already in use. Please choose another email address.',
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
          error:
            'That phone number is already in use. Please choose another number.',
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
        error:
          'That name is already in use. Please confirm if you want to use this name.',
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
    up.createdDate = req.body.createdDate;
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
      const createdUserProfile = await up.save();
      res.status(200).send({
        _id: createdUserProfile._id,
      });

      // update backend cache
      const userCache = {
        permissions: up.permissions,
        isActive: true,
        weeklycommittedHours: up.weeklycommittedHours,
        createdDate: up.createdDate.toISOString(),
        _id: up._id,
        role: up.role,
        firstName: up.firstName,
        lastName: up.lastName,
        email: up.email,
      };
      const allUserCache = JSON.parse(cache.getCache('allusers'));
      allUserCache.push(userCache);
      cache.setCache('allusers', JSON.stringify(allUserCache));
    } catch (error) {
      res.status(501).send(error);
    }
  };

  const putUserProfile = async function (req, res) {
    const userid = req.params.userId;
    const isRequestorAuthorized = !!(
      canRequestorUpdateUser(req.body.requestor.requestorId, userid)
      && ((await hasPermission(req.body.requestor, 'putUserProfile'))
        || req.body.requestor.requestorId === userid)
    );

    if (!isRequestorAuthorized) {
      res.status(403).send('You are not authorized to update this user');
      return;
    }

    if (
      req.body.role === 'Owner'
      && !(await hasPermission(req.body.requestor, 'addDeleteEditOwners'))
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
      // validate userprofile pic

      if (req.body.profilePic) {
        const results = userHelper.validateProfilePic(req.body.profilePic);

        if (!results.result) {
          res.status(400).json(results.errors);
          return;
        }
      }

      const canEditTeamCode = req.body.requestor.role === 'Owner'
        || req.body.requestor.role === 'Administrator'
        || req.body.requestor.permissions?.frontPermissions.includes(
          'editTeamCode',
        );

      if (!canEditTeamCode && record.teamCode !== req.body.teamCode) {
        res.status(403).send('You are not authorized to edit team code.');
        return;
      }

      const originalinfringements = record.infringements
        ? record.infringements
        : [];

      const commonFields = [
        'jobTitle',
        'emailPubliclyAccessible',
        'phoneNumberPubliclyAccessible',
        'profilePic',
        'firstName',
        'lastName',
        'jobTitle',
        'phoneNumber',
        'bio',
        'personalLinks',
        'location',
        'profilePic',
        'privacySettings',
        'weeklySummaries',
        'weeklySummariesCount',
        'mediaUrl',
        'timeZone',
        'hoursByCategory',
        'totalTangibleHrs',
        'totalIntangibleHrs',
        'isFirstTimelog',
        'teamCode',
        'isVisible',
        'isRehireable',
        'bioPosted',
      ];

      commonFields.forEach((fieldName) => {
        if (req.body[fieldName] !== undefined) {
          record[fieldName] = req.body[fieldName];
        }
      });

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
      if (
        await hasPermission(req.body.requestor, 'putUserProfileImportantInfo')
      ) {
        const importantFields = [
          'role',
          'isRehireable',
          'isActive',
          'adminLinks',
          'isActive',
          'weeklySummaries',
          'weeklySummariesCount',
          'mediaUrl',
          'collaborationPreference',
          'weeklySummaryNotReq',
          'weeklySummaryOption',
          'categoryTangibleHrs',
          'totalTangibleHrs',
          'timeEntryEditHistory',
        ];

        if (req.body.role !== record.role && req.body.role === 'Mentor') record.isVisible = false;

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
          record.projects = Array.from(new Set(req.body.projects));
        }

        if (req.body.email !== undefined) {
          record.email = req.body.email.toLowerCase();
        }

        // Logic to update weeklycommittedHours and the history of the committed hours made
        if (
          req.body.weeklycommittedHours !== undefined
          && record.weeklycommittedHours !== req.body.weeklycommittedHours
        ) {
          record.weeklycommittedHours = req.body.weeklycommittedHours;

          // If their last update was made today, remove that
          const lasti = record.weeklycommittedHoursHistory.length - 1;
          const lastChangeDate = moment(
            record.weeklycommittedHoursHistory[lasti].dateChanged,
          );
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

        if (
          req.body.createdDate !== undefined
          && record.createdDate !== req.body.createdDate
        ) {
          record.createdDate = moment(req.body.createdDate).toDate();
          // Make sure weeklycommittedHoursHistory isn't empty
          if (record.weeklycommittedHoursHistory.length === 0) {
            const newEntry = {
              hours: record.weeklycommittedHours,
              dateChanged: Date.now(),
            };
            record.weeklycommittedHoursHistory.push(newEntry);
          }
          // then also change the first committed history (index 0)
          record.weeklycommittedHoursHistory[0].dateChanged = record.createdDate;
        }

        if (
          req.body.permissions !== undefined
          && (await hasPermission(req.body.requestor, 'putUserProfilePermissions'))
        ) {
          record.permissions = req.body.permissions;
        }

        if (req.body.endDate !== undefined) {
          if (yearMonthDayDateValidator(req.body.endDate)) {
            record.endDate = moment(req.body.endDate).toDate();
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
          userData.createdDate = record.createdDate.toISOString();
        }
      }
      if (
        req.body.infringements !== undefined
        && (await hasPermission(req.body.requestor, 'infringementAuthorizer'))
      ) {
        record.infringements = req.body.infringements;
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

  const deleteUserProfile = async function (req, res) {
    const { option, userId } = req.body;
    if (!(await hasPermission(req.body.requestor, 'deleteUserProfile'))) {
      res.status(403).send('You are not authorized to delete users');
      return;
    }

    if (
      req.body.role === 'Owner'
      && !(await hasPermission(req.body.requestor, 'addDeleteEditOwners'))
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
    const user = await UserProfile.findById(userId);

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
        logger.logException(
          'Time Archive user was not found. Please check the database',
        );
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
    const allUserData = JSON.parse(cache.getCache('allusers'));
    const userIdx = allUserData.findIndex((users) => users._id === userId);
    allUserData.splice(userIdx, 1);
    cache.setCache('allusers', JSON.stringify(allUserData));

    await UserProfile.deleteOne({
      _id: userId,
    });
    res.status(200).send({ message: 'Executed Successfully' });
  };

  const getUserById = function (req, res) {
    const userid = req.params.userId;
    if (cache.getCache(`user-${userid}`)) {
      const getData = JSON.parse(cache.getCache(`user-${userid}`));
      res.status(200).send(getData);
      return;
    }

    UserProfile.findById(
      userid,
      '-password -refreshTokens -lastModifiedDate -__v',
    )
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
            select:
              '_id badgeName type imageUrl description ranking showReport',
          },
        },
      ])
      .exec()
      .then((results) => {
        if (!results) {
          res.status(400).send({ error: 'This is not a valid user' });
          return;
        }
        userHelper
          .getTangibleHoursReportedThisWeekByUserId(userid)
          .then((hours) => {
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

  const updateOneProperty = function (req, res) {
    const { userId } = req.params;
    const { key, value } = req.body;

    if (key === 'teamCode') {
      const canEditTeamCode = req.body.requestor.role === 'Owner'
        || req.body.requestor.role === 'Administrator'
        || req.body.requestor.permissions?.frontPermissions.includes(
          'editTeamCode',
        );

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
        user.set({
          [key]: value,
        });

        return user
          .save()
          .then(() => {
            res.status(200).send({ message: 'updated property' });
          })
          .catch((error) => res.status(500).send(error));
      })
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
    if (
      !req.body.currentpassword
      || !req.body.newpassword
      || !req.body.confirmnewpassword
    ) {
      return res.status(400).send({
        error: 'One of more required fields are missing',
      });
    }
    // Check if the requestor has the permission to update passwords.
    const hasUpdatePasswordPermission = await hasPermission(
      requestor,
      'updatePassword',
    );

    // If the requestor is updating their own password, allow them to proceed.
    if (userId === requestor.requestorId) {
      console.log('Requestor is updating their own password');
    }
    // Else if they're updating someone else's password, they need the 'updatePassword' permission.
    else if (!hasUpdatePasswordPermission) {
      console.log(
        "Requestor is trying to update someone else's password but lacks the 'updatePassword' permission",
      );
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
              .then(() => res.status(200).send({ message: 'updated password' }))
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

    let validroles = [
      'Volunteer',
      'Manager',
      'Administrator',
      'Core Team',
      'Owner',
      'Mentor',
    ];

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

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).send({
        error: 'Bad Request',
      });
      return;
    }
    if (!(await hasPermission(req.body.requestor, 'changeUserStatus'))) {
      res.status(403).send('You are not authorized to change user status');
      return;
    }
    cache.removeCache(`user-${userId}`);
    UserProfile.findById(userId, 'isActive')
      .then((user) => {
        user.set({
          isActive: status,
          reactivationDate: activationDate,
          endDate,
          isSet,
        });
        user
          .save()
          .then(() => {
            const isUserInCache = cache.hasCache('allusers');
            if (isUserInCache) {
              const allUserData = JSON.parse(cache.getCache('allusers'));
              const userIdx = allUserData.findIndex(
                (users) => users._id === userId,
              );
              const userData = allUserData[userIdx];
              if (!status) {
                userData.endDate = user.endDate.toISOString();
              }
              userData.isActive = user.isActive;
              allUserData.splice(userIdx, 1, userData);
              cache.setCache('allusers', JSON.stringify(allUserData));
            }
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

  const resetPassword = function (req, res) {
    ValidatePassword(req);

    UserProfile.findById(req.params.userId, 'password')
      .then((user) => {
        user.set({
          password: req.body.newpassword,
        });
        user
          .save()
          .then(() => {
            res.status(200).send({
              message: ' password Reset',
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

  // Search for user by first name
  const getUserBySingleName = (req, res) => {
    const pattern = new RegExp(`^${req.params.singleName}`, 'i');

    // Searches for first or last name
    UserProfile.find({
      $or: [
        { firstName: { $regex: pattern } },
        { lastName: { $regex: pattern } },
      ],
    })
      .select('firstName lastName')
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
  const getUserByFullName = (req, res) => {
    // Creates an array containing the first and last name and filters out whitespace
    const fullName = req.params.fullName
      .split(' ')
      .filter((name) => name !== '');
    // Creates a partial match regex for both first and last name
    const firstNameRegex = new RegExp(`^${escapeRegExp(fullName[0])}`, 'i');
    const lastNameRegex = new RegExp(`^${escapeRegExp(fullName[1])}`, 'i');

    // Verfies both the first and last name are present
    if (fullName.length < 2) {
      return res
        .status(400)
        .send({ error: 'Both first name and last name are required.' });
    }

    UserProfile.find({
      $and: [
        { firstName: { $regex: firstNameRegex } },
        { lastName: { $regex: lastNameRegex } },
      ],
    })
      .select('firstName lastName')
      .then((users) => {
        if (users.length === 0) {
          return res.status(404).send({ error: 'Users Not Found' });
        }
        res.status(200).send(users);
      })
      .catch((error) => res.status(500).send(error));
  };

  /**
   * Authorizes user to be able to add Weekly Report Recipients
   *
   */
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
          $regex: escapeRegex(authorizedUser), // The Authorized user's email would now be saved in the .env file
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

  return {
    postUserProfile,
    getUserProfiles,
    putUserProfile,
    deleteUserProfile,
    getUserById,
    getreportees,
    updateOneProperty,
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
    authorizeUser,
  };
};

module.exports = userProfileController;
