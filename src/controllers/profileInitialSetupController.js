const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const emailSender = require('../utilities/emailSender');
const config = require('../config');
const cache = require('../utilities/nodeCache')();

// returns the email body that includes the setup link for the recipient.
function sendLinkMessage(Link) {
  const message = `<p>Hello,</p>
    <p>Welcome to the One Community Highest Good Network! We’re excited to have you as a new member of our team.<br>
    To work as a member of our volunteer team, you need to complete the following profile setup:</p>   
    <p><a href="${Link}">Click to Complete Profile</a></p>
    <p>Please complete all fields and be accurate. If you have any questions or need assistance during the profile setup process, please contact your manager.</p>
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

const sendEmailWithAcknowledgment = (email, subject, message) => new Promise((resolve, reject) => {
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
) {
  const { JWT_SECRET } = config;

  const setMapLocation = async (locationData) => {
    const location = new MapLocation(locationData);

    try {
      const response = await location.save();
      return response;
    } catch (err) {
      return {
        type: 'Error',
        message: err.message || 'An error occurred while saving the location',
      };
    }
  };

  /*
  Function to handle token generation and email process:
  - Generates a new token and saves it to the database.
  - If the email already has a token, the old one is deleted.
  - Sets the token expiration to three weeks.
  - Generates a link using the token and emails it to the recipient.
   */
  const getSetupToken = async (req, res) => {
    let { email, baseUrl, weeklyCommittedHours } = req.body;
    email = email.toLowerCase();
    const token = uuidv4();
    const expiration = moment().tz('America/Los_Angeles').add(3, 'week');
    try {
      const existingEmail = await userProfile.findOne({
        email,
      });
      if (existingEmail) {
        res.status(400).send('email already in use');
      } else {
        await ProfileInitialSetupToken.findOneAndDelete({ email });

        const newToken = new ProfileInitialSetupToken({
          token,
          email,
          weeklyCommittedHours,
          expiration: expiration.toDate(),
        });

        const savedToken = await newToken.save();
        const link = `${baseUrl}/ProfileInitialSetup/${savedToken.token}`;

        const acknowledgment = await sendEmailWithAcknowledgment(
          email,
          'NEEDED: Complete your One Community profile setup',
          sendLinkMessage(link),
        );

        res.status(200).send(acknowledgment);
      }
    } catch (error) {
      res.status(400).send(`Error: ${error}`);
    }
  };

  /*
  Function to validate a token:
  - Checks if the token exists in the database.
  - Verifies that the token's expiration date has not passed yet.
    */
  const validateSetupToken = async (req, res) => {
    const { token } = req.body;
    const currentMoment = moment.tz('America/Los_Angeles');
    try {
      const foundToken = await ProfileInitialSetupToken.findOne({ token });

      if (foundToken) {
        const expirationMoment = moment(foundToken.expiration);

        if (expirationMoment.isAfter(currentMoment)) {
          res.status(200).send(foundToken);
        } else {
          res.status(400).send('Invalid token');
        }
      } else {
        res.status(404).send('Token not found');
      }
    } catch (error) {
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
    const currentMoment = moment.tz('America/Los_Angeles');
    try {
      const foundToken = await ProfileInitialSetupToken.findOne({ token });
      const existingEmail = await userProfile.findOne({
        email: foundToken.email,
      });
      if (existingEmail) {
        res.status(400).send('email already in use');
      } else if (foundToken) {
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
            expiryTimestamp: moment().add(
              config.TOKEN.Lifetime,
              config.TOKEN.Units,
            ),
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
          res.status(400).send('Token is expired');
        }
      } else {
        res.status(400).send('Invalid token');
      }
    } catch (error) {
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
      res.status(200).send({ userAPIKey: premiumKey });
    } else {
      res.status(403).send('Unauthorized Request');
    }
  };

  const getTotalCountryCount = async (req, res) => {
    try {
      const users = [];
      const results = await userProfile.find(
        {},
        'location totalTangibleHrs hoursByCategory',
      );

      results.forEach((item) => {
        if (
          (item.location?.coords.lat
            && item.location?.coords.lng
            && item.totalTangibleHrs >= 10)
          || (item.location?.coords.lat
            && item.location?.coords.lng
            && calculateTotalHours(item.hoursByCategory) >= 10)
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
      res.status(200).send({ CountryCount: totalUniqueCountries });
    } catch (error) {
      res.status(500).send(`Error: ${error}`);
    }
  };

  function calculateTotalHours(hoursByCategory) {
    let hours = 0;
    Object.keys(hoursByCategory).forEach((x) => {
      hours += hoursByCategory[x];
    });
    return hours;
  }

  return {
    getSetupToken,
    setUpNewUser,
    validateSetupToken,
    getTimeZoneAPIKeyByToken,
    getTotalCountryCount,
  };
};

module.exports = profileInitialSetupController;
