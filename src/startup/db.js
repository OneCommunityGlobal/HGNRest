
const mongoose = require('mongoose');
const logger = require('./logger');
const userProfile = require('../models/userProfile');

mongoose.Promise = Promise;

const afterConnect = async () => {
  try {
    const user = await userProfile.findOne(
      {
        firstName: { $regex: 'TimeArchiveAccount', $options: 'i' },
        lastName: { $regex: 'TimeArchiveAccount', $options: 'i' },
      },
    );

    if (!user) {
      userProfile.create({
        firstName: 'TimeArchiveAccount',
        lastName: 'TimeArchiveAccount',
        email: 'TimeArchiveAccount@yopmail.com',
        role: 'Volunteer',
        password: '123Welcome!',
      })
        .then(result => logger.logInfo(`TimeArchive account was created with id of ${result._id}`))
        .catch(error => logger.logException(error));
    }
  } catch (error) {
    console.log(error);
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
