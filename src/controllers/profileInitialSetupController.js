const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const { error } = require('console');

const profileInitialSetupController = function (ProfileInitialSetupToken, userProfile) {

    const getSetupToken = (req, res) => {
        const { email } = req.body
        const token = uuidv4();
        const expiration = moment().tz('America/Los_Angeles').add(1, 'week')
        ProfileInitialSetupToken.findOneAndDelete({ email })
            .then((deletedToken) => {
                if (deletedToken) {
                    console.log('Existing token entry deleted:', deletedToken);
                } else {
                    console.log('No existing token entry found');
                }
                const newToken = new ProfileInitialSetupToken({
                    token,
                    email,
                    expiration: expiration.toDate(),
                });

                return newToken.save();
            })
            .then((savedToken) => {
                res.status(200).send(savedToken)
            })
            .catch((error) => {
                res.status(400).send(error);
            });
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