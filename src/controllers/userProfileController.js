const moment = require('moment-timezone');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const moment_ = require('moment');
const jwt = require('jsonwebtoken');
const userHelper = require('../helpers/userHelper')();
const TimeEntry = require('../models/timeentry');
const logger = require('../startup/logger');
const Badge = require('../models/badge');
const yearMonthDayDateValidator = require('../utilities/yearMonthDayDateValidator');
const cache = require('../utilities/nodeCache')();
const hasPermission = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const config = require('../config');

function ValidatePassword(req, res) {
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
    !userId === requestor.requestorId
    && !hasPermission(requestor.role, 'updatePassword')
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
  const getUserProfiles = function (req, res) {
    if (!hasPermission(req.body.requestor.role, 'getUserProfiles')) {
      res.status(403).send('You are not authorized to view all users');
      return;
    }

    if (cache.getCache('allusers')) {
      const getData = JSON.parse(cache.getCache('allusers'));
      res.status(200).send(getData);
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
          res.status(500).send({ error: 'User result was invalid' });
          return;
        }
        cache.setCache('allusers', JSON.stringify(results));
        res.status(200).send(results);
      })
      .catch(error => res.status(404).send(error));
  };

  const getProjectMembers = function (req, res) {
    if (!hasPermission(req.body.requestor.role, 'getProjectMembers')) {
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
    if (!hasPermission(req.body.requestor.role, 'postUserProfile')) {
      res.status(403).send('You are not authorized to create new users');
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

    const up = new UserProfile();
    up.password = req.body.password;
    up.role = req.body.role;
    up.firstName = req.body.firstName;
    up.lastName = req.body.lastName;
    up.jobTitle = req.body.jobTitle;
    up.phoneNumber = req.body.phoneNumber;
    up.bio = req.body.bio;
    up.weeklycommittedHours = req.body.weeklycommittedHours;
    up.personalLinks = req.body.personalLinks;
    up.adminLinks = req.body.adminLinks;
    up.teams = Array.from(new Set(req.body.teams));
    up.projects = Array.from(new Set(req.body.projects));
    up.createdDate = Date.now();
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

    up.save()
      .then(() => {
        res.status(200).send({
          _id: up._id,
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
      })
      .catch(error => res.status(501).send(error));
  };

  const putUserProfile = function (req, res) {
    const userid = req.params.userId;
    const isRequestorAuthorized = !!(
      hasPermission(req.body.requestor.role, 'putUserProfile')
      || req.body.requestor.requestorId === userid
    );

    if (!isRequestorAuthorized) {
      res.status(403).send('You are not authorized to update this user');
      return;
    }
    cache.removeCache(`user-${userid}`);
    UserProfile.findById(userid, (err, record) => {
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

      const originalinfringements = record.infringements ? record.infringements : [];
      record.jobTitle = req.body.jobTitle;
      record.emailPubliclyAccessible = req.body.emailPubliclyAccessible;
      record.phoneNumberPubliclyAccessible = req.body.phoneNumberPubliclyAccessible;

      record.profilePic = req.body.profilePic;
      record.firstName = req.body.firstName;
      record.lastName = req.body.lastName;
      record.jobTitle = req.body.jobTitle;
      record.phoneNumber = req.body.phoneNumber;
      record.bio = req.body.bio;
      record.personalLinks = req.body.personalLinks;
      record.lastModifiedDate = Date.now();
      record.location = req.body.location;
      record.profilePic = req.body.profilePic;
      record.privacySettings = req.body.privacySettings;
      record.weeklySummaries = req.body.weeklySummaries;
      record.weeklySummariesCount = req.body.weeklySummariesCount;
      record.mediaUrl = req.body.mediaUrl;
      record.timeZone = req.body.timeZone;
      record.hoursByCategory = req.body.hoursByCategory;
      record.totalTangibleHrs = req.body.totalTangibleHrs;
      record.isVisible = req.body.isVisible || false;
      record.isRehireable = req.body.isRehireable || false;
      record.totalIntangibleHrs = req.body.totalIntangibleHrs;
      record.bioPosted = req.body.bioPosted || 'default';

      // find userData in cache
      const isUserInCache = cache.hasCache('allusers');
      let allUserData;
      let userData;
      let userIdx;
      if (isUserInCache) {
        allUserData = JSON.parse(cache.getCache('allusers'));
        userIdx = allUserData.findIndex(users => users._id === userid);
        userData = allUserData[userIdx];
      }
      if (
        hasPermission(req.body.requestor.role, 'putUserProfileImportantInfo')
      ) {
        record.role = req.body.role;
        record.isRehireable = req.body.isRehireable;
        record.isActive = req.body.isActive;
        record.weeklycommittedHours = req.body.weeklycommittedHours;
        record.missedHours = req.body.role === 'Core Team' ? (req.body?.missedHours ?? 0) : 0;
        record.adminLinks = req.body.adminLinks;
        record.teams = Array.from(new Set(req.body.teams));
        record.projects = Array.from(new Set(req.body.projects));
        record.isActive = req.body.isActive;
        record.email = req.body.email.toLowerCase();
        record.weeklySummaries = req.body.weeklySummaries;
        record.weeklySummariesCount = req.body.weeklySummariesCount;
        record.mediaUrl = req.body.mediaUrl;
        record.collaborationPreference = req.body.collaborationPreference;
        record.weeklySummaryNotReq = req.body.weeklySummaryNotReq
          ? req.body.weeklySummaryNotReq
          : record.weeklySummaryNotReq;
        record.weeklySummaryOption = req.body.weeklySummaryOption;
        record.categoryTangibleHrs = req.body.categoryTangibleHrs
          ? req.body.categoryTangibleHrs
          : record.categoryTangibleHrs;
        record.totalTangibleHrs = req.body.totalTangibleHrs;
        record.timeEntryEditHistory = req.body.timeEntryEditHistory;
        record.createdDate = moment(req.body.createdDate).toDate();
        record.bioPosted = req.body.bioPosted || 'default';

        if (hasPermission(req.body.requestor.role, 'putUserProfilePermissions')) { record.permissions = req.body.permissions; }

        if (yearMonthDayDateValidator(req.body.endDate)) {
          record.endDate = moment(req.body.endDate).toDate();
          if (isUserInCache) {
            userData.endDate = record.endDate.toISOString();
          }
        } else {
          record.set('endDate', undefined, { strict: false });
        }
        if (isUserInCache) {
          userData.role = record.role;
          userData.weeklycommittedHours = record.weeklycommittedHours;
          userData.email = record.email;
          userData.isActive = record.isActive;
          userData.createdDate = record.createdDate.toISOString();
        }
      }
      if (hasPermission(req.body.requestor.role, 'infringementAuthorizer')) {
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
        .catch(error => res.status(400).send(error));
    });
  };

  const deleteUserProfile = async function (req, res) {
    const { option, userId } = req.body;
    if (
      !userId
      || !option
      || (option !== 'delete' && option !== 'archive')
      || !hasPermission(req.body.requestor.role, 'deleteUserProfile')
    ) {
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
          firstName: 'TimeArchiveAccount',
          lastName: 'TimeArchiveAccount',
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
    const userIdx = allUserData.findIndex(users => users._id === userId);
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
            select: '_id badgeName type imageUrl description ranking',
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
      .catch(error => res.status(404).send(error));
  };

  const getUserByName = (req, res) => {
    const { name } = req.params;
    UserProfile.find(
      { firstName: name.split(' ')[0], lastName: name.split(' ')[1] },
      '_id, profilePic, badgeCollection',
    )
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };


  const updateOneProperty = function (req, res) {
    const { userId } = req.params;
    const { key, value } = req.body;

    // remove user from cache, it should be loaded next time
    cache.removeCache(`user-${userId}`);
    if (!key || value === undefined) return res.status(400).send({ error: 'Missing property or value' });

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
              .catch(error => res.status(500).send(error));
      })
      .catch(error => res.status(500).send(error));
  };

  const updatepassword = function (req, res) {
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
    // Verify request is authorized by self or adminsitrator
    if (
      !userId === requestor.requestorId
      && !hasPermission(requestor.role, 'updatePassword')
    ) {
      return res.status(403).send({
        error: "You are unauthorized to update this user's password",
      });
    }
    // Verify new and confirm new password are correct

    if (req.body.newpassword !== req.body.confirmnewpassword) {
      res.status(400).send({
        error: 'New and confirm new passwords are not same',
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
              .catch(error => res.status(500).send(error));
          })
          .catch(error => res.status(500).send(error));
      })
      .catch(error => res.status(500).send(error));
  };

  const getreportees = function (req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      res.status(400).send({
        error: 'Bad request',
      });
      return;
    }

    const userid = mongoose.Types.ObjectId(req.params.userId);
    const { role } = req.body.requestor;

    let validroles = [
      'Volunteer',
      'Manager',
      'Administrator',
      'Core Team',
      'Owner',
      'Mentor',
    ];

    if (hasPermission(role, 'getReporteesLimitRoles')) {
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
      .catch(error => res.status(400).send(error));
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
      .catch(error => res.status(400).send(error));
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

  const changeUserStatus = function (req, res) {
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
    if (!hasPermission(req.body.requestor.role, 'changeUserStatus')) {
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
                users => users._id === userId,
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
      expiryTimestamp: moment_().add(config.TOKEN.Lifetime, config.TOKEN.Units),
    };
    const currentRefreshToken = jwt.sign(jwtPayload, JWT_SECRET);
    res.status(200).send({ refreshToken: currentRefreshToken });
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
  };
};

module.exports = userProfileController;
