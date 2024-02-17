
const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const logger = require('../startup/logger');

const badgeCountController = function () {
    // Function to get badge count for a user
    const getBadgeCount = async function (req, res) {
        const userId = mongoose.Types.ObjectId(req.params.userId);

        UserProfile.findById(userId, (error, record) => {
            // Check for errors or if user profile doesn't exist
            if (error || record === null) {
                res.status(400).send('Can not find the user to be assigned.');
                return;
            }
            // Return badge count from user profile
            res.status(200).send(record.badgeCount);
        });
    };

    const putBadgecount = async function (req, res) {
        // Extract user ID from request parameters and convert it to a MongoDB ObjectId
        const userId = mongoose.Types.ObjectId(req.params.userId);

        // Find user profile by ID
        UserProfile.findById(userId, (error, record) => {
            // Check for errors or if user profile doesn't exist
            if (error || record === null) {
                // Return error response
                res.status(400).send('Can not find the user to be assigned.');
                return;
            }
            // Update badge count to 0
            record.badgeCount = 0;

            record
                .save()
                .then(results => res.status(201).send(results._id)) // Return ID of updated record
                .catch((err) => {
                    // Log any exceptions
                    logger.logException(err);
                    // Return internal server error response
                    res.status(500).send('Internal Error: Unable to save the record.');
                });
        });
    };

    return {
        getBadgeCount,
        putBadgecount,
    };
};

module.exports = badgeCountController;
