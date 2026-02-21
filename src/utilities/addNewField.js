/**
 * Run this script once using "node src/utilities/addNewField.js"
 * It will create a new field called "weeklycommittedHoursHistory"
 * and it will populate it with its created Date
 */
require('dotenv').config();

const mongoose = require('mongoose');
const logger = require('../startup/logger');
const userProfile = require('../models/userProfile');

mongoose.Promise = Promise;

/**
 * This function is to delete "weeklycommittedHoursHistory" to each user
 */
/* const deleteUserField = async () => {
  try {
    // remove 'weeklycommittedHoursHistory' field from all user
    await userProfile.updateMany({}, { $unset: { weeklycommittedHoursHistory: '' } });
  } catch (error) {
    logger.logException('Error removing field:', error);
  }
};
*/
/**
 * This function is to add "weeklycommittedHoursHistory" to each user
 * and fill it in using the created date. Only run this once in production
 * Although running multiple times will not do any harm too since
 * there is a check of if this field already exist
 */
const addNewField = async () => {
  try {
    // Check if 'weeklycommittedHoursHistory' field exists in any document
    const userWithNoField = await userProfile.find({
      weeklycommittedHoursHistory: { $exists: false },
    });

    // 2. Iterate over each user profile
    await Promise.all(
      userWithNoField.map(async (user) => {
        // 3. Create the new entry (currentWeeklyCommittedHours, dateChanged)
        const newEntry = {
          hours: user.weeklycommittedHours,
          dateChanged: user.createdDate, // or any other field which has the date you need
        };

        // Use updateOne with $push to add newEntry to the weeklycommittedHoursHistory array
        await userProfile.updateOne(
          { _id: user._id },
          { $push: { weeklycommittedHoursHistory: newEntry } },
        );
      }),
    );
  } catch (error) {
    logger.logException('Error adding field:', error);
  }
};

/**
 * This function is to see if the field "weeklycommittedHoursHistory"
 * is successfully added for each user profile
 */
const checkNewField = async () => {
  try {
    // 1. Retrieve all user profiles
    const userProfiles = await userProfile.find({});

    // 2. Iterate over each user profile
    await Promise.all(
      userProfiles.map(async () => {
        // Processing user
      }),
    );
  } catch (error) {
    // console.log('Error checking new field', error);
    logger.logException('Checking new field:', error);
  }
};

const run = function () {
  //   console.log('connect db');
  const uri = `mongodb+srv://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;

  mongoose
    .connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    })
    // .then(deleteUserField)
    .then(addNewField)
    .then(checkNewField)
    .catch((err) => logger.logException(err)); // handles errors from the connect function
};

run();
