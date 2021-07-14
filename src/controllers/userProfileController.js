const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userhelper = require('../helpers/userhelper')();
const TimeEntry = require('../models/timeentry');
const logger = require('../startup/logger');
const Badge = require('../models/badge');

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
    && !requestor.role === 'Administrator'
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
    const AuthorizedRolesToView = ['Manager', 'Administrator', 'Core Team'];
    const isRequestorAuthorized = !!AuthorizedRolesToView.includes(
      req.body.requestor.role,
    );

    if (!isRequestorAuthorized) {
      res.status(403).send('You are not authorized to view all users');
      return;
    }

    UserProfile.find(
      {},
      '_id firstName lastName role weeklyComittedHours email isActive reactivationDate createdDate endDate',
    )
      .sort({
        lastName: 1,
      })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const getProjectMembers = function (req, res) {
    const AuthorizedRolesToView = ['Manager', 'Administrator', 'Core Team'];
    const isRequestorAuthorized = !!AuthorizedRolesToView.includes(
      req.body.requestor.role,
    );
    if (!isRequestorAuthorized) {
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
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send('You are not authorized to create new users');
      return;
    }
    const _email = req.body.email;
    const userbyemail = await UserProfile.findOne({
      email: {
        $regex: _email,
        $options: 'i',
      },
    });

    if (userbyemail) {
      const error = 'Email already exists. Please choose another email.';
      res.status(400).send({
        error,
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
    up.weeklyComittedHours = req.body.weeklyComittedHours;
    up.personalLinks = req.body.personalLinks;
    up.adminLinks = req.body.adminLinks;
    up.teams = Array.from(new Set(req.body.teams));
    up.projects = Array.from(new Set(req.body.projects));
    up.createdDate = Date.now();
    up.email = _email;
    up.weeklySummaries = req.body.weeklySummaries || [{ summary: '' }];
    up.weeklySummariesCount = req.body.weeklySummariesCount || 0;
    up.mediaUrl = req.body.mediaUrl || '';
    up.collaborationPreference = req.body.collaborationPreference || '';

    up.save()
      .then(() => res.status(200).send({
        _id: up._id,
      }))
      .catch(error => res.status(501).send(error));
  };

  const putUserProfile = function (req, res) {
    const userid = req.params.userId;

    const isRequestorAuthorized = !!(
      req.body.requestor.role === 'Administrator'
      || req.body.requestor.role === 'Manager'
      || req.body.requestor.requestorId === userid
    );
    const isRequestorAdmin = req.body.requestor.role === 'Administrator';

    if (!isRequestorAuthorized) {
      res.status(403).send('You are not authorized to update this user');
      return;
    }
    UserProfile.findById(userid, (err, record) => {
      if (err || !record) {
        res.status(404).send('No valid records found');
        return;
      }
      // validate userprofile pic

      if (req.body.profilePic) {
        const results = userhelper.validateprofilepic(req.body.profilePic);

        if (!results.result) {
          res.status(400).json(results.errors);
          return;
        }
      }

      // let requested_infringments = (req.body.infringments)? (req.body.infringments): [];
      const originalInfringments = record.infringments
        ? record.infringments
        : [];

      const infringmentAuthorizers = ['Manager', 'Administrator'];

      // jobTitle,emailPubliclyAccessible,phoneNumberPubliclyAccessible fields
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
      record.profilePic = req.body.profilePic;
      record.privacySettings = req.body.privacySettings;

      record.weeklySummaries = req.body.weeklySummaries;
      record.weeklySummariesCount = req.body.weeklySummariesCount;
      record.mediaUrl = req.body.mediaUrl;

      if (isRequestorAdmin) {
        record.role = req.body.role;
        record.isActive = req.body.isActive;
        record.weeklyComittedHours = req.body.weeklyComittedHours;
        record.adminLinks = req.body.adminLinks;
        record.teams = Array.from(new Set(req.body.teams));
        record.projects = Array.from(new Set(req.body.projects));
        record.isActive = req.body.isActive;
        record.email = req.body.email.toLowerCase();
        record.weeklySummaries = req.body.weeklySummaries;
        record.weeklySummariesCount = req.body.weeklySummariesCount;
        record.mediaUrl = req.body.mediaUrl;
        record.collaborationPreference = req.body.collaborationPreference;
      }

      if (infringmentAuthorizers.includes(req.body.requestor.role)) {
        record.infringments = req.body.infringments;
      }

      record
        .save()
        .then((results) => {
          userhelper.notifyInfringments(
            originalInfringments,
            results.infringments,
            results.firstName,
            results.lastName,
            results.email,
          );
          res.status(200).json({
            _id: record._id,
          });
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
      || req.body.requestor.role !== 'Administrator'
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

    await UserProfile.deleteOne({
      _id: userId,
    });
    res.status(200).send({ message: 'Executed Successfully' });
  };

  const getUserById = function (req, res) {
    const userid = req.params.userId;

    UserProfile.findById(
      userid,
      '-password -lastModifiedDate -createdDate -__v',
    )
      .populate({
        path: 'teams',
        select: '_id teamName',
        options: {
          sort: {
            teamName: 1,
          },
        },
      })
      .populate({
        path: 'projects',
        select: '_id projectName',
        options: {
          sort: {
            projectName: 1,
          },
        },
      })
      .populate({
        path: 'badgeCollection',
        populate: {
          path: 'badge',
          model: Badge,
          select: '_id badgeName type imageUrl description ranking',
        },
      })
      .then((results) => {
        if (!results) {
          res.status(400).send({ error: 'This is not a valid user' });
          return;
        }
        res.status(200).send(results);
      })

      .catch(error => res.status(404).send(error));
  };

  const getUserByName = (req, res) => {
    const { name } = req.params;
    UserProfile.find({ firstName: name.split(' ')[0], lastName: name.split(' ')[1] }, '_id, profilePic, badgeCollection')
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
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
    if (
      !req.body.currentpassword
      || !req.body.newpassword
      || !req.body.confirmnewpassword
    ) {
      return res.status(400).send({
        error: 'One of more required fields are missing',
      });
    }
    // Verify request is authorized by self or adminsitrator
    if (
      !userId === requestor.requestorId
      && !requestor.role === 'Administrator'
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

    let validroles = ['Volunteer', 'Manager', 'Administrator', 'Core Team'];

    if (role === 'Volunteer' || role === 'Manager') {
      validroles = ['Volunteer', 'Manager'];
    }

    userhelper
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
    userhelper
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
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).send({
        error: 'Bad Request',
      });
      return;
    }
    UserProfile.findById(userId, 'isActive')
      .then((user) => {
        user.set({
          isActive: status,
          reactivationDate: activationDate,
          endDate: (activationDate ? undefined : Date.now()),
        });
        user
          .save()
          .then(() => {
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

  return {
    postUserProfile,
    getUserProfiles,
    putUserProfile,
    deleteUserProfile,
    getUserById,
    getreportees,
    updatepassword,
    getUserName,
    getTeamMembersofUser,
    getProjectMembers,
    changeUserStatus,
    resetPassword,
    getUserByName,
    getAllUsersWithFacebookLink,
  };
};

module.exports = userProfileController;
