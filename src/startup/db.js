
const mongoose = require('mongoose');
const logger = require('./logger');
const userProfile = require('../models/userProfile');
const initialPermissions = require('../utilities/createInitialPermissions');
const config = require('../config');

const {
  DEF_PWD,
  TIME_ARCHIVE_FIRST_NAME,
  TIME_ARCHIVE_LAST_NAME,
  TIME_ARCHIVE_EMAIL,
  } = config;
mongoose.Promise = Promise;

const afterConnect = async () => {
  try {
    const user = await userProfile.findOne(
      {
        firstName: { $regex: TIME_ARCHIVE_FIRST_NAME, $options: 'i' },
        lastName: { $regex: TIME_ARCHIVE_LAST_NAME, $options: 'i' },
      },
    );

    await initialPermissions();
    if (!user) {
      userProfile.create({
        firstName: TIME_ARCHIVE_FIRST_NAME,
        lastName: TIME_ARCHIVE_LAST_NAME,
        email: TIME_ARCHIVE_EMAIL,
        role: 'Volunteer',
        password: DEF_PWD,
      })
        .then(result => logger.logInfo(`TimeArchive account was created with id of ${result._id}`))
        .catch(error => logger.logException(error));
    }
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = function () {
  const uri = `mongodb://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?ssl=true&replicaSet=${process.env.replicaSetName}&authSource=admin`;

  mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
    .then(afterConnect)
    .catch(err => logger.logException(err));
};
