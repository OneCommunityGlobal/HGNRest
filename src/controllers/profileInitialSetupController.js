const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const emailSender = require('../utilities/emailSender');


// Welcome to the One Community Highest Good Network! We’re excited to have you as a new member of our team.
// To work as a member of our volunteer team, you need to complete the following profile setup:
// Click to Complete Profile
// Please complete all fields and be accurate. If you have any questions or need assistance during the profile setup process, please contact your manager.
// Thank you and welcome!
// With Gratitude,
// One Community

function sendLinkMessage(Link) {
    const message = `<p>Hello,</p>
    <p>Welcome to the One Community Highest Good Network! We’re excited to have you as a new member of our team.<br>
    To work as a member of our volunteer team, you need to complete the following profile setup:</p>
    
    <p><a href="${Link}">Click to Complete Profile</a></p>
    <p>Please complete all fields and be accurate. If you have any questions or need assistance during the profile setup process, please contact your manager.</p>
    <p>If you have any questions or need assistance during the profile setup process, please don't hesitate to reach out to your manager.</p>
    <p>Thank you and welcome!</p>
    <p>With Gratitude,<br>
    One Community.</p>`;
    return message;
}

const profileInitialSetupController = function (ProfileInitialSetupToken, userProfile, Project) {

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
                'Complete your profile setup for Highest Good Network App',
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
                    await ProfileInitialSetupToken.findByIdAndDelete(foundToken._id);


                    res.status(200).send(savedUser);
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