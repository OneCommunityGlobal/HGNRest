const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const emailSender = require('../utilities/emailSender');
const config = require('../config');
const cache = require('../utilities/nodeCache')();
const LOGGER = require('../startup/logger');

const TOKEN_HAS_SETUP_MESSAGE = 'SETUP_ALREADY_COMPLETED';
const TOKEN_CANCEL_MESSAGE = 'CANCELLED';
const TOKEN_INVALID_MESSAGE = 'INVALID';
const TOKEN_EXPIRED_MESSAGE = 'EXPIRED';
const TOKEN_NOT_FOUND_MESSAGE = 'NOT_FOUND';
const { startSession } = mongoose;

const { hasPermission } = require('../utilities/permissions');

// returns the email body that includes the setup link for the recipient.
function sendLinkMessage(Link) {
  const message = `<p>Hello,</p>
    <p>Welcome to the One Community Highest Good Network! We’re excited to have you as a new member of our team.<br>
    To work as a member of our volunteer team, you need to complete the following profile setup:</p>   
    <p><a href="${Link}">Click to Complete Profile</a></p>
    <p><b>Please complete the profile setup within 21 days of this invite. </b></p>
    <p>Please complete all fields and be accurate. If you have any questions or need assistance during the profile setup process, please contact your manager.</p>
    <p>Thank you and welcome!</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  return message;
}

function sendRefreshedLinkMessage(Link) {
  const message = `<p>Hello,</p>
    <p>You setup link is refreshed! Welcome to the One Community Highest Good Network! We’re excited to have you as a new member of our team.<br>
    To work as a member of our volunteer team, you need to complete the following profile setup by:</p>   
    <p><a href="${Link}">Click to Complete Profile</a>  </p>
    <p><b>Please complete the profile setup within 21 days of this invite. </b></p>
    <p>Please complete all fields and be accurate. If you have any questions or need assistance during the profile setup process, please contact your manager.</p>
    <p>Thank you and welcome!</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  return message;
}

function sendCancelLinkMessage() {
  const message = `<p>Hello,</p>
    <p>Your setup link has been deactivated by the administrator. </p>
    <p>If you have any questions or need assistance during the profile setup process, please contact your manager.</p>
    <p>Thank you and welcome!</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  return message;
}

// returns the email body containing the details of the newly created user.
function informManagerMessage(user) {
  const message = `
  <p>Hello,</p>
  <p>New User <b style="text-transform: capitalize;">${user.firstName} ${user.lastName}</b> has completed their part of setup.</p>
  <p>These areas need to now be completed by an Admin:</p>
  <ul style="padding-left: 20px;padding-bottom:10px;">
    <li>Admin Document</li>
    <li>Link to Media Files</li>
    <li>Assign Projects</li>
    <li>4-digit Admin Code</li>
    <li>And (if applicable) Assign Team</li>
  </ul>
    <table border="1" cellpadding="10">
        <tr>
            <td><strong>First Name:</strong></td>
            <td>${user.firstName}</td>
        </tr>
        <tr>
            <td><strong>Last Name:</strong></td>
            <td>${user.lastName}</td>
        </tr>
        <tr>
            <td><strong>Email:</strong></td>
            <td>${user.email}</td>
        </tr>
        <tr>
            <td><strong>Phone Number:</strong></td>
            <td>+${user.phoneNumber}</td>
        </tr>
        <tr>
            <td><strong>Collaboration Preference:</strong></td>
            <td>${user.collaborationPreference}</td>
        </tr>
        <tr>
            <td><strong>Job Title:</strong></td>
            <td>${user.jobTitle}</td>
        </tr>
        <tr>
            <td><strong>Weekly Commited Hours:</strong></td>
            <td>${user.weeklycommittedHours}</td>
        </tr>
        <tr>
            <td><strong>Time Zone:</strong></td>
            <td>${user.timeZone}</td>
        </tr>
        <tr>
            <td><strong>Location:</strong></td>
            <td>${user.location.userProvided}, ${user.location.country}</td>
        </tr>
    </table> 
    <br>
    <p>Thank you,</p>
    <p>One Community</p>`;
  return message;
}

const sendEmailWithAcknowledgment = (email, subject, message) =>
  new Promise((resolve, reject) => {
    emailSender(email, subject, message, null, null, null, (error, result) => {
      if (result) resolve(result);
      if (error) reject(result);
    });
  });

const profileInitialSetupController = function (
  ProfileInitialSetupToken,
  userProfile,
  Project,
  MapLocation,
  MapLocation,
) {
  const { JWT_SECRET } = config;

  /**
   * Function to handle token generation and email process:
    - Generates a new token and saves it to the database.
    - If the email already has a token, the old one is deleted.
    - Sets the token expiration to three weeks.
  - Generates a link using the token and emails it to the recipient.
   * @param {*} req payload include: email, baseUrl, weeklyCommittedHours
   * @param {*} res 
   */
  const getSetupToken = async (req, res) => {
    let { email } = req.body;
    const { baseUrl, weeklyCommittedHours } = req.body;

    if (
      !(await hasPermission(req.body.requestor, 'userManagementFullFunctionality')) &&
      !(await hasPermission(req.body.requestor, 'postUserProfile'))
    ) {
      return res.status(403).send('You are not authorized to send setup link');
    }

    email = email.toLowerCase();
    const token = uuidv4();
    const expiration = moment().add(3, 'week');
    // Wrap multiple db operations in a transaction
    const session = await startSession();
    session.startTransaction();

    try {
      const existingEmail = await userProfile
        .findOne({
          email,
        })
        .session(session);

      if (existingEmail) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).send('email already in use');
      }

      await ProfileInitialSetupToken.findOneAndDelete({ email }).session(session);

      const newToken = new ProfileInitialSetupToken({
        token,
        email,
        weeklyCommittedHours,
        expiration: expiration.toDate(),
        isSetupCompleted: false,
        isCancelled: false,
        createdDate: Date.now(),
      });

      const savedToken = await newToken.save({ session });
      const link = `${baseUrl}/ProfileInitialSetup/${savedToken.token}`;
      await session.commitTransaction();

      const acknowledgment = await sendEmailWithAcknowledgment(
        email,
        'NEEDED: Complete your One Community profile setup',
        sendLinkMessage(link),
      );

      return res.status(200).send(acknowledgment);
    } catch (error) {
      await session.abortTransaction();
      LOGGER.logException(error, 'getSetupToken', JSON.stringify(req.body), null);
      return res.status(400).send(`Error: ${error}`);
    } finally {
      session.endSession();
    }
  };

  /**
   * Function to validate a token:
    - Checks if the token exists in the database.
    - Verifies that the token's expiration date has not passed yet.
   * @param {*} req 
   * @param {*} res 
   */
  const validateSetupToken = async (req, res) => {
    const { token } = req.body;
    const currentMoment = moment.now();
    try {
      const foundToken = await ProfileInitialSetupToken.findOne({ token });

      if (foundToken) {
        const expirationMoment = moment(foundToken.expiration);
        // Check if the token is already used
        if (foundToken.isSetupCompleted) {
          return res.status(400).send(TOKEN_HAS_SETUP_MESSAGE);
        }
        // Check if the token is cancelled
        if (foundToken.isCancelled) {
          return res.status(400).send(TOKEN_CANCEL_MESSAGE);
        }
        // Check if the token is expired
        if (expirationMoment.isBefore(currentMoment)) {
          return res.status(400).send(TOKEN_EXPIRED_MESSAGE);
        }
        return res.status(200).send(foundToken);
      }
      // Token not found
      return res.status(404).send(TOKEN_NOT_FOUND_MESSAGE);
    } catch (error) {
      LOGGER.logException(error, 'validateSetupToken', JSON.stringify(req.body), null);
      res.status(500).send(`Error finding token: ${error}`);
    }
  };

  /*
  Function for creating and authenticating a new user:
  - Validates the token used to submit the form.
  - Creates a new user using the information received through req.body.
  - Sends an email to the manager to inform them of the new user creation.
  - Deletes the token used for user creation from the database.
  - Generates a JWT token using the newly created user information.
  - Sends the JWT as a response.
*/
  const setUpNewUser = async (req, res) => {
    const { token } = req.body;

    if (
      !(await hasPermission(req.body.requestor, 'userManagementFullFunctionality')) &&
      !(await hasPermission(req.body.requestor, 'postUserProfile'))
    ) {
      return res.status(403).send('You are not authorized to setup new user');
    }

    const currentMoment = moment.now(); // use UTC for comparison
    try {
      const foundToken = await ProfileInitialSetupToken.findOne({ token });

      if (!foundToken) {
        res.status(400).send('Invalid token');
        return;
      }

      const existingEmail = await userProfile.findOne({
        email: foundToken.email,
      });

      if (existingEmail) {
        return res.status(400).send('email already in use');
      }
      if (foundToken) {
        const expirationMoment = moment(foundToken.expiration);

        if (expirationMoment.isAfter(currentMoment)) {
          const defaultProject = await Project.findOne({
            projectName: 'Orientation and Initial Setup',
          });

          const newUser = new userProfile();
          newUser.password = req.body.password;
          newUser.role = 'Volunteer';
          newUser.firstName = req.body.firstName;
          newUser.lastName = req.body.lastName;
          newUser.jobTitle = req.body.jobTitle;
          newUser.phoneNumber = req.body.phoneNumber;
          newUser.bio = '';
          newUser.weeklycommittedHours = foundToken.weeklyCommittedHours;
          newUser.weeklycommittedHoursHistory = [
            {
              hours: newUser.weeklycommittedHours,
              dateChanged: Date.now(),
            },
          ];
          newUser.personalLinks = [];
          newUser.adminLinks = [];
          newUser.teams = Array.from(new Set([]));
          newUser.projects = Array.from(new Set([defaultProject]));
          newUser.createdDate = Date.now();
          newUser.email = req.body.email;
          newUser.weeklySummaries = [{ summary: '' }];
          newUser.weeklySummariesCount = 0;
          newUser.weeklySummaryOption = 'Required';
          newUser.mediaUrl = '';
          newUser.collaborationPreference = req.body.collaborationPreference;
          newUser.timeZone = req.body.timeZone || 'America/Los_Angeles';
          newUser.location = req.body.location;
          newUser.profilePic = req.body.profilePicture;
          newUser.permissions = {
            frontPermissions: [],
            backPermissions: [],
          };
          newUser.bioPosted = 'default';
          newUser.privacySettings.email = req.body.privacySettings.email;
          newUser.privacySettings.phoneNumber = req.body.privacySettings.phoneNumber;
          newUser.teamCode = '';
          newUser.isFirstTimelog = true;
          newUser.homeCountry = req.body.homeCountry || req.body.location;

          const savedUser = await newUser.save();

          emailSender(
            process.env.MANAGER_EMAIL || 'jae@onecommunityglobal.org', // "jae@onecommunityglobal.org"
            `NEW USER REGISTERED: ${savedUser.firstName} ${savedUser.lastName}`,
            informManagerMessage(savedUser),
            null,
            null,
          );
          await ProfileInitialSetupToken.findByIdAndDelete(foundToken._id);

          const jwtPayload = {
            userid: savedUser._id,
            role: savedUser.role,
            permissions: savedUser.permissions,
            expiryTimestamp: moment().add(config.TOKEN.Lifetime, config.TOKEN.Units),
          };

          const token = jwt.sign(jwtPayload, JWT_SECRET);

          const locationData = {
            title: '',
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            jobTitle: req.body.jobTitle,
            location: req.body.homeCountry,
            isActive: true,
          };

          res.send({ token }).status(200);

          const mapEntryResult = await setMapLocation(locationData);
          if (mapEntryResult.type === 'Error') {
            console.log(mapEntryResult.message);
          }

          const NewUserCache = {
            permissions: savedUser.permissions,
            isActive: true,
            weeklycommittedHours: savedUser.weeklycommittedHours,
            createdDate: savedUser.createdDate.toISOString(),
            _id: savedUser._id,
            role: savedUser.role,
            firstName: savedUser.firstName,
            lastName: savedUser.lastName,
            email: savedUser.email,
          };

          const allUserCache = JSON.parse(cache.getCache('allusers'));
          allUserCache.push(NewUserCache);
          cache.setCache('allusers', JSON.stringify(allUserCache));
        } else {
          return res.status(400).send('Token is expired');
        }
      } else {
        return res.status(400).send('Invalid token');
      }

      const expirationMoment = moment(foundToken.expiration);
      if (foundToken.isSetupCompleted) {
        return res.status(400).send('User has been setup already.');
      }
      if (foundToken.isCancelled) {
        return res.status(400).send('Token is invalided by admin.');
      }
      if (expirationMoment.isBefore(currentMoment)) {
        return res.status(400).send('Token has expired.');
      }

      const defaultProject = await Project.findOne({
        projectName: 'Orientation and Initial Setup',
      });

      const newUser = new userProfile();
      newUser.password = req.body.password;
      newUser.role = 'Volunteer';
      newUser.firstName = req.body.firstName;
      newUser.lastName = req.body.lastName;
      newUser.jobTitle = req.body.jobTitle;
      newUser.phoneNumber = req.body.phoneNumber;
      newUser.bio = '';
      newUser.weeklycommittedHours = foundToken.weeklyCommittedHours;
      newUser.weeklycommittedHoursHistory = [
        {
          hours: newUser.weeklycommittedHours,
          dateChanged: Date.now(),
        },
      ];
      newUser.personalLinks = [];
      newUser.adminLinks = [];
      newUser.teams = Array.from(new Set([]));
      newUser.projects = Array.from(new Set([defaultProject]));
      newUser.createdDate = Date.now();
      newUser.email = req.body.email;
      newUser.weeklySummaries = [{ summary: '' }];
      newUser.weeklySummariesCount = 0;
      newUser.weeklySummaryOption = 'Required';
      newUser.mediaUrl = '';
      newUser.collaborationPreference = req.body.collaborationPreference;
      newUser.timeZone = req.body.timeZone || 'America/Los_Angeles';
      newUser.location = req.body.location;
      newUser.profilePic = req.body.profilePicture;
      newUser.permissions = {
        frontPermissions: [],
        backPermissions: [],
      };
      newUser.bioPosted = 'default';
      newUser.privacySettings.email = req.body.privacySettings.email;
      newUser.privacySettings.phoneNumber = req.body.privacySettings.phoneNumber;
      newUser.teamCode = '';
      newUser.isFirstTimelog = true;
      newUser.homeCountry = req.body.homeCountry || req.body.location;

      const savedUser = await newUser.save();

      emailSender(
        process.env.MANAGER_EMAIL || 'jae@onecommunityglobal.org', // "jae@onecommunityglobal.org"
        `NEW USER REGISTERED: ${savedUser.firstName} ${savedUser.lastName}`,
        informManagerMessage(savedUser),
        null,
        null,
      );

      const jwtPayload = {
        userid: savedUser._id,
        role: savedUser.role,
        permissions: savedUser.permissions,
        expiryTimestamp: moment().add(config.TOKEN.Lifetime, config.TOKEN.Units),
      };

      const jwtToken = jwt.sign(jwtPayload, JWT_SECRET);

      res.status(200).send({ token: jwtToken });
      await ProfileInitialSetupToken.findOneAndUpdate(
        { _id: foundToken._id },
        { isSetupCompleted: true },
        { new: true },
      );

      const NewUserCache = {
        permissions: savedUser.permissions,
        isActive: true,
        weeklycommittedHours: savedUser.weeklycommittedHours,
        createdDate: savedUser.createdDate.toISOString(),
        _id: savedUser._id,
        role: savedUser.role,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        email: savedUser.email,
      };

      const allUserCache = JSON.parse(cache.getCache('allusers'));
      allUserCache.push(NewUserCache);
      cache.setCache('allusers', JSON.stringify(allUserCache));
    } catch (error) {
      LOGGER.logException(error);
      res.status(500).send(`Error: ${error}`);
    }
  };

  /*
  Function for sending https://opencagedata.com API key:
  - Checks if token used in the request is valid.
  - sends the API Key as response
 */
  const getTimeZoneAPIKeyByToken = async (req, res) => {
    const { token } = req.body;
    const premiumKey = process.env.TIMEZONE_PREMIUM_KEY;

    const foundToken = await ProfileInitialSetupToken.findOne({ token });

    if (foundToken) {
      return res.status(200).send({ userAPIKey: premiumKey });
    }
    return res.status(403).send('Unauthorized Request');
  };

  function calculateTotalHours(hoursByCategory) {
    let hours = 0;
    Object.keys(hoursByCategory).forEach((x) => {
      hours += hoursByCategory[x];
    });
    return hours;
  }

  const getTotalCountryCount = async (req, res) => {
    try {
      const users = [];
      const results = await userProfile.find({}, 'location totalTangibleHrs hoursByCategory');

      results.forEach((item) => {
        if (
          (item.location?.coords.lat && item.location?.coords.lng && item.totalTangibleHrs >= 10) ||
          (item.location?.coords.lat &&
            item.location?.coords.lng &&
            calculateTotalHours(item.hoursByCategory) >= 10)
        ) {
          users.push(item);
        }
      });
      const modifiedUsers = users.map((item) => ({
        location: item.location,
      }));

      const mapUsers = await MapLocation.find({});
      const combined = [...modifiedUsers, ...mapUsers];
      const countries = combined.map((user) => user.location.country);
      const totalUniqueCountries = [...new Set(countries)].length;
      return res.status(200).send({ CountryCount: totalUniqueCountries });
    } catch (error) {
      LOGGER.logException(error, 'Error in getTotalCountryCount');
      return res.status(500).send(`Error: ${error}`);
    }
  };

  /**
   * Returns a list of setup token in not completed status
   * @param {*} req HTTP request include requester role information
   * @param {*} res HTTP response include setup invitation records response's body
   * @returns a list of setup invitation records which setup is not complete
   */
  const getSetupInvitation = (req, res) => {
    const { role } = req.body.requestor;
    if (role === 'Administrator' || role === 'Owner') {
      try {
        ProfileInitialSetupToken.find({ isSetupCompleted: false })
          .sort({ createdDate: -1 })
          .exec((err, result) => {
            // Handle the result
            if (err) {
              LOGGER.logException(err);
              return res
                .status(500)
                .send(
                  'Internal Error: Please retry. If the problem persists, please contact the administrator',
                );
            }
            return res.status(200).send(result);
          });
      } catch (error) {
        LOGGER.logException(error);
        return res
          .status(500)
          .send(
            'Internal Error: Please retry. If the problem persists, please contact the administrator',
          );
      }
    } else {
      return res.status(403).send('You are not authorized to get setup history.');
    }
  };

  /**
   * Cancel the setup token
   * @param {*} req HTTP request include requester role information
   * @param {*} res HTTP response include whether the setup invitation record is successfully cancelled
   * @returns
   */
  const cancelSetupInvitation = (req, res) => {
    const { role } = req.body.requestor;
    const { token } = req.body;
    if (role === 'Administrator' || role === 'Owner') {
      try {
        ProfileInitialSetupToken.findOneAndUpdate(
          { token },
          { isCancelled: true },
          (err, result) => {
            if (err) {
              LOGGER.logException(err);
              return res
                .status(500)
                .send(
                  'Internal Error: Please retry. If the problem persists, please contact the administrator',
                );
            }
            sendEmailWithAcknowledgment(
              result.email,
              'One Community: Your Profile Setup Link Has Been Deactivated',
              sendCancelLinkMessage(),
            );
            return res.status(200).send(result);
          },
        );
      } catch (error) {
        LOGGER.logException(error);
        return res
          .status(500)
          .send(
            'Internal Error: Please retry. If the problem persists, please contact the administrator',
          );
      }
    } else {
      res.status(403).send('You are not authorized to cancel setup invitation.');
    }
  };
  /**
   * Update the expired setup token to active status. After refreshing, the expiration date will be extended by 3 weeks.
   * @param {*} req HTTP request include requester role information
   * @param {*} res HTTP response include whether the setup invitation record is successfully refreshed
   * @returns updated result of the setup invitation record.
   */
  const refreshSetupInvitation = async (req, res) => {
    const { role } = req.body.requestor;
    const { token, baseUrl } = req.body;

    if (role === 'Administrator' || role === 'Owner') {
      try {
        ProfileInitialSetupToken.findOneAndUpdate(
          { token },
          {
            expiration: moment().add(3, 'week'),
            isCancelled: false,
          },
        )
          .then((result) => {
            const { email } = result;
            const link = `${baseUrl}/ProfileInitialSetup/${result.token}`;
            sendEmailWithAcknowledgment(
              email,
              'Invitation Link Refreshed: Complete Your One Community Profile Setup',
              sendRefreshedLinkMessage(link),
            );
            return res.status(200).send(result);
          })
          .catch((err) => {
            LOGGER.logException(err);
            res
              .status(500)
              .send(
                'Internal Error: Please retry. If the problem persists, please contact the administrator',
              );
          });
      } catch (error) {
        return res
          .status(500)
          .send(
            'Internal Error: Please retry. If the problem persists, please contact the administrator',
          );
      }
    } else {
      return res.status(403).send('You are not authorized to refresh setup invitation.');
    }
  };

  // const expiredSetupInvitation = (req, res) => {
  //   const { role } = req.body.requestor;
  //   const { token } = req.body;
  //   if (role === 'Administrator' || role === 'Owner') {
  //   ProfileInitialSetupToken
  //     .findOneAndUpdate(
  //       { token },
  //       {
  //         expiration: moment().tz('America/Los_Angeles').subtract(1, 'minutes'),
  //       },
  //       (err, result) => {
  //         if (err) {
  //           // LOGGER.logException(err);
  //           return res.status(500).send('Internal Error: Please retry. If the problem persists, please contact the administrator');
  //         }
  //           return res.status(200).send(result);
  //       },
  //     );
  //   }
  // };

  return {
    getSetupToken,
    setUpNewUser,
    validateSetupToken,
    getTimeZoneAPIKeyByToken,
    getTotalCountryCount,
    getSetupInvitation,
    cancelSetupInvitation,
    refreshSetupInvitation,
  };
};

module.exports = profileInitialSetupController;
