const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const initialPermissions = require('../utilities/createInitialPermissions');
const encodeMongoPassword = require('../utilities/mongoPasswordEncoder');
const { insertDefaultFAQs } = require('../models/faqs');
const logger = require('./logger');
require('dotenv').config();

mongoose.set('strictQuery', true); // Suppress deprecation warning, prepare for Mongoose 7
mongoose.Promise = Promise;

const afterConnect = async () => {
  try {
    const user = await userProfile.findOne({
      firstName: { $regex: process.env.TIME_ARCHIVE_FIRST_NAME, $options: 'i' },
      lastName: { $regex: process.env.TIME_ARCHIVE_LAST_NAME, $options: 'i' },
    });

    await initialPermissions();
    await insertDefaultFAQs();
    if (!user) {
      userProfile
        .create({
          firstName: process.env.TIME_ARCHIVE_FIRST_NAME,
          lastName: process.env.TIME_ARCHIVE_LAST_NAME,
          email: process.env.TIME_ARCHIVE_EMAIL,
          role: 'Volunteer',
          password: process.env.DEF_PWD,
        })
        .then((result) =>
          logger.logInfo(`TimeArchive account was created with id of ${result._id}`),
        )
        .catch((error) => logger.logException(error));
    }
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = function () {
  try {
    const encodedPassword = encodeMongoPassword(process.env.password);
    const { user } = process.env;
    const { cluster } = process.env;
    const { dbName } = process.env;
    const { appName } = process.env;

    // Validate all required environment variables are present
    if (!user || !encodedPassword || !cluster || !dbName) {
      throw new Error(
        `Missing required MongoDB environment variables: user=${!!user}, password=${!!encodedPassword}, cluster=${!!cluster}, dbName=${!!dbName}`,
      );
    }

    // Construct URI with proper encoding for all components
    const uri = `mongodb+srv://${user}:${encodedPassword}@${cluster}/${dbName}?retryWrites=true&w=majority${appName ? `&appName=${encodeURIComponent(appName)}` : ''}`;

    mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })
      .then(() => {
        logger.logInfo('✅ MongoDB connected successfully');
        return afterConnect();
      })
      .catch((err) => {
        logger.logException(new Error(`❌ MongoDB connection failed: ${err.message}`));
      });
  } catch (error) {
    logger.logException(error);
  }
};
