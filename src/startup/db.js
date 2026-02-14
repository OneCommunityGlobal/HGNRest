/* eslint-disable no-console */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const initialPermissions = require('../utilities/createInitialPermissions');
const logger = require('./logger');
require('dotenv').config();

mongoose.Promise = Promise;

/* 👇 ADD HERE */
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});
/* 👆 ADD HERE */

const afterConnect = async () => {
  try {
    const user = await userProfile.findOne({
      firstName: { $regex: process.env.TIME_ARCHIVE_FIRST_NAME, $options: 'i' },
      lastName: { $regex: process.env.TIME_ARCHIVE_LAST_NAME, $options: 'i' },
    });

    await initialPermissions();
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
  // Remove port from cluster if present (mongodb+srv doesn't support ports)
  const cluster = process.env.cluster ? process.env.cluster.split(':')[0] : '';
  const uri = `mongodb+srv://${process.env.user}:${encodeURIComponent(process.env.password)}@${cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;
  mongoose
    .connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    })
    .then(afterConnect)
    .catch((err) => logger.logException(err));
};
