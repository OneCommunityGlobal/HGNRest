const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const emailSender = require('../utilities/emailSender');


function sendLinkMessage(Link) {
    const message = `<p>Hello,</p>
    <p>Welcome to the Highest Good Network! We're excited to have you as a new member.<br> To get started, we kindly request you to complete your profile setup.</p>
    <p>Please click on the following link to access your profile setup page:</p>
    <p><a href="${Link}">Profile Setup Page</a></p>
    <p>On the profile setup page, you'll be able to provide the necessary information to setup your user account. We encourage you to fill in all the requested details accurately.</p>
    <p>If you have any questions or need assistance during the profile setup process, please don't hesitate to reach out to your manager.</p>
    <p>Thank you for choosing One Community.</p>
    <p>Best regards,<br>
    One Community<br>
    Highest Good Network Team</p>`;
    return message;
}

const profileInitialSetupController = function (ProfileInitialSetupToken, userProfile) {

    const getSetupToken = async (req, res) => {
        const { email, baseUrl } = req.body
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

    const setUpNewUser = (req, res) => {

        const { token } = req.body
        const currentMoment = moment.tz('America/Los_Angeles');

        ProfileInitialSetupToken.findOne({ token })
            .then((foundToken) => {
                if (foundToken) {
                    const expirationMoment = moment(foundToken.expiration);
                    if (expirationMoment.isAfter(currentMoment)) {
                        const newUser = new userProfile();
                        newUser.password = req.body.password
                        newUser.role = req.body.role
                        newUser.firstName = req.body.firstName
                        newUser.lastName = req.body.lastName
                        newUser.jobTitle = req.body.jobTitle
                        newUser.phoneNumber = req.body.phoneNumber
                        newUser.bio = req.body.bio
                        newUser.weeklycommittedHours = req.body.weeklycommittedHours
                        newUser.weeklySummaryOption = req.body.weeklySummaryOption
                        newUser.personalLinks = req.body.personalLinks
                        newUser.adminLinks = req.body.adminLinks
                        newUser.email = req.body.email
                        newUser.location = req.body.location
                        newUser.teams = Array.from(new Set(req.body.teams));
                        newUser.projects = Array.from(new Set(req.body.projects));
                        newUser.createdDate = Date.now();
                        newUser.save()
                            .then((savedUser) => {
                                ProfileInitialSetupToken.findByIdAndDelete(foundToken._id)
                                    .then((deletedToken) => {
                                        res.status(200).send(savedUser);
                                    }).catch((error) => {
                                        res.status(500).send('unable to delete token:', error);
                                    })
                            })
                            .catch((error) => {
                                res.status(500).send('Error saving user:', error);
                            });

                    } else {
                        res.status(400).send("token has expired")
                    }

                } else {
                    res.status(400).send("Invalid token")
                }
            })
            .catch((error) => {
                res.status(500).send('Error finding token:', error)
            });

    }


    return {
        getSetupToken,
        setUpNewUser
    }
};

module.exports = profileInitialSetupController;