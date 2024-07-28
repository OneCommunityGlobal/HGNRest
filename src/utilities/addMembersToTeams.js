/**
 * !!! Run this script once using "node src/utilities/addMembersToTeams.js"
 * It will create a new field called "members"
 * and it will populate it with users' created Date ny default
 */
require('dotenv').load();

const mongoose = require('mongoose');
const logger = require('../startup/logger');
const UserProfile = require('../models/userProfile');
const Teams = require('../models/team');

const addMembersField = async () => {
  await Teams.updateMany({}, { $set: { members: [] } }).catch(error => logger.logException('Error adding field:', error));

  const allUsers = await UserProfile.find({});
  const updateOperations = allUsers
    .map((user) => {
      const { _id, teams, createdDate } = user;
      return teams.map(team => Teams.updateOne({ _id: team }, { $addToSet: { members: { userId: _id, addDateTime: createdDate } } }));
    })
    .flat();

  await Promise.all(updateOperations).catch(error => logger.logException(error));
};

const deleteMembersField = async () => {
  await Teams.updateMany({}, { $unset: { members: '' } }).catch(err => console.error(err));
};

const run = () => {
  console.log('Loading... This may take a few minutes!');
  const uri = `mongodb://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${
    process.env.dbName
  }?ssl=true&replicaSet=${process.env.replicaSetName}&authSource=admin`;

  mongoose
    .connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    })
    // .then(deleteMembersField)
    .then(addMembersField)
    .catch(err => logger.logException(err))
    .finally(() => {
      mongoose.connection.close();
      console.log('Done! ✅');
    });
};

run();
