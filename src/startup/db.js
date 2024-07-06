const mongoose = require('mongoose');
const logger = require('./logger');
const userProfile = require('../models/userProfile');
const initialPermissions = require('../utilities/createInitialPermissions');
require('dotenv').config();

mongoose.Promise = Promise;

const afterConnect = async () => {
  try {
    const user = await userProfile.findOne({
      firstName: { $regex: process.env.TIME_ARCHIVE_FIRST_NAME, $options: 'i' },
      lastName: { $regex: process.env.TIME_ARCHIVE_LAST_NAME, $options: 'i' },
    });

    console.log('connected to mongodb');

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
  const uri = `mongodb://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?ssl=true&replicaSet=${process.env.replicaSetName}&authSource=admin&retryWrites=false`;

  mongoose
    .connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    })
    .then(afterConnect)
    .catch((err) => logger.logException(err));
};
