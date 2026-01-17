/**
 * !!! Run this script once using "node src/utilities/addMembersToTeams.js"
 * It will create a new field called "members"
 * and it will populate it with users' created Date ny default
 */
require('dotenv').config();

const mongoose = require('mongoose');
const logger = require('../startup/logger');
const UserProfile = require('../models/userProfile');
const Teams = require('../models/team');
const encodeMongoPassword = require('./mongoPasswordEncoder');

const addMembersField = async () => {
  await Teams.updateMany({}, { $set: { members: [] } }).catch((error) =>
    logger.logException('Error adding field:', error),
  );

  const allUsers = await UserProfile.find({});
  const updateOperations = allUsers
    .map((user) => {
      const { _id, teams, createdDate } = user;
      return teams.map((team) =>
        Teams.updateOne(
          { _id: team },
          { $addToSet: { members: { userId: _id, addDateTime: createdDate, visibility: true } } },
        ),
      );
    })
    .flat();

  await Promise.all(updateOperations).catch((error) => logger.logException(error));
};

// const deleteMembersField = async () => {
//  await Teams.updateMany({}, { $unset: { members: '' } }).catch((err) => console.error(err));
// };

const run = () => {
  const uri = `mongodb+srv://${process.env.user}:${encodeMongoPassword(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;

  mongoose
    .connect(uri)
    // .then(deleteMembersField)
    .then(addMembersField)
    .catch((err) => logger.logException(err))
    .finally(() => {
      mongoose.connection.close();
    });
};

run();
