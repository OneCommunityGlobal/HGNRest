const mongoose = require('mongoose');
const UserProfileModel = require('../models/userProfile');
const logger = require('../startup/logger');
/**
 * This function take a list of user email and return a list of user profiles projection that only contains the user ID and user email.
 * @param {Array<String>} userEmails A list of user email
 * @returns {Array<mongoose.Model>} A list of user profiles projection that only contains the user ID and user email.
 */
async function getUserIdAndEmailByEmails(userEmails) {
  if (!Array.isArray(userEmails)) {
    throw new Error('Invalid user email list');
  }
  try {
    return await UserProfileModel.find({ email: { $in: userEmails } }, '_id email');
  } catch (error) {
    throw new Error(`Could not fetch user profiles: ${error.message}`);
  }
}

/**
 * This function takes a user ID and returns the name of the user.
 * @param {*} userId
 * @returns {mongoose.Model} The user profile projection contains the first/last name, and email of the user.
 */
async function getUserFullNameAndEmailById(userId) {
  try {
    return await UserProfileModel.findById(userId, 'firstName lastName email');
  } catch (error) {
    logger.logException(error, 'Error getting user full name');
    return null;
  }
}

module.exports = {
  getUserIdAndEmailByEmails,
  getUserFullNameAndEmailById,
};
