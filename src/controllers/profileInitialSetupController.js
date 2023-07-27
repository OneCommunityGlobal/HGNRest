const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const emailSender = require('../utilities/emailSender');
const config = require('../config');



function sendLinkMessage(Link) {
    const message = `<p>Hello,</p>
    <p>Welcome to the One Community Highest Good Network! We’re excited to have you as a new member of our team.<br>
    To work as a member of our volunteer team, you need to complete the following profile setup:</p>   
    <p><a href="${Link}">Click to Complete Profile</a></p>
    <p>Please complete all fields and be accurate. If you have any questions or need assistance during the profile setup process, please contact your manager.</p>
    <p>Thank you and welcome!</p>
    <p>With Gratitude,<br>
    One Community.</p>`;
    return message;
}

function informManagerMessage(user) {
    const message = `
    <p>Hello,</p>
    <p>A new user has created their profile on our platform. Below is the information provided by the user:</p> 
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
            <td>${user.phoneNumber}</td>
        </tr>
        <tr>
            <td><strong>Weekly Committed Hours:</strong></td>
            <td>${user.weeklycommittedHours}</td>
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
            <td><strong>Time Zone:</strong></td>
            <td>${user.timeZone}</td>
        </tr>
        <tr>
            <td><strong>Location:</strong></td>
            <td>${user.location}</td>
        </tr>
    </table> 
    <p>Please check the details provided by the user. If any errors were made, kindly ask them to correct the information accordingly.</p> 
    <p>Thank you,</p>
    <p>One Community.</p>`;
    return message;
}

const profileInitialSetupController = function (ProfileInitialSetupToken, userProfile, Project) {
    const { JWT_SECRET } = config;

    const getSetupToken = async (req, res) => {
        let { email, baseUrl } = req.body
        email = email.toLowerCase()
        const token = uuidv4();
        const expiration = moment().tz('America/Los_Angeles').add(1, 'week')

        try {
            await ProfileInitialSetupToken.findOneAndDelete({ email });

            const newToken = new ProfileInitialSetupToken({
                token,
                email,
                expiration: expiration.toDate(),
            });

            const savedToken = await newToken.save();
            const link = `${baseUrl}/ProfileInitialSetup/${savedToken.token}`

            emailSender(
                email,
                'NEEDED: Complete your One Community profile setup',
                sendLinkMessage(link),
                null,
                null,
            );

            res.status(200).send(`${baseUrl}/ProfileInitialSetup/${savedToken.token}`);

        } catch (err) {
            res.status(400).send(error);
        }

    }

    const validateSetupToken = async (req, res) => {
        const { token } = req.body
        const currentMoment = moment.tz('America/Los_Angeles');
        try {

            const foundToken = await ProfileInitialSetupToken.findOne({ token });

            if (foundToken) {
                const expirationMoment = moment(foundToken.expiration);

                if (expirationMoment.isAfter(currentMoment)) {
                    res.status(200).send("Valid token");
                } else {
                    res.status(400).send("Invalid token");
                }
            } else {
                res.status(404).send("Token not found")
            }
        } catch (error) {
            res.status(500).send(`Error finding token: ${error}`);
        }

    }

    const setUpNewUser = async (req, res) => {

        try {
            const { token } = req.body;
            const currentMoment = moment.tz('America/Los_Angeles');

            const foundToken = await ProfileInitialSetupToken.findOne({ token });

            if (foundToken) {
                const expirationMoment = moment(foundToken.expiration);

                if (expirationMoment.isAfter(currentMoment)) {
                    const defaultProject = await Project.findOne({ projectName: "Orientation and Initial Setup" })
                    const newUser = new userProfile();
                    newUser.password = req.body.password
                    newUser.role = "Volunteer";
                    newUser.firstName = req.body.firstName;
                    newUser.lastName = req.body.lastName;
                    newUser.jobTitle = req.body.jobTitle;
                    newUser.phoneNumber = req.body.phoneNumber;
                    newUser.bio = "";
                    newUser.weeklycommittedHours = req.body.weeklycommittedHours;
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
                    newUser.bioPosted = 'default';
                    newUser.privacySettings.email = req.body.privacySettings.email
                    newUser.privacySettings.phoneNumber = req.body.privacySettings.phoneNumber
                    const savedUser = await newUser.save();
                    emailSender(
                        process.env.MANAGER_EMAIL,
                        'New User Profile Created',
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

                    res.send({ token }).status(200);
                } else {
                    res.status(400).send("Token has expired");
                }
            } else {
                res.status(400).send("Invalid token");
            }
        } catch (error) {
            res.status(500).send(`Error: ${error}`);
        }

    }

    const getTimeZoneAPIKeyByToken = async (req, res) => {
        const token = req.body.token;
        const premiumKey = process.env.TIMEZONE_PREMIUM_KEY;

        const foundToken = await ProfileInitialSetupToken.findOne({ token });

        if (foundToken) {
            res.status(200).send({ userAPIKey: premiumKey });
            return;
        } else {
            res.status(403).send('Unauthorized Request');
            return;
        }

    };

    return {
        getSetupToken,
        setUpNewUser,
        validateSetupToken,
        getTimeZoneAPIKeyByToken
    }
};

module.exports = profileInitialSetupController;