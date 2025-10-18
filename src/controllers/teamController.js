const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const { hasPermission } = require('../utilities/permissions');
const cache = require('../utilities/nodeCache')();
const Logger = require('../startup/logger');
const helper = require('../utilities/permissions');

const INTERNAL_SERVER_ERROR = 'Internal server error';

const teamcontroller = function (Team) {
  const getAllTeams = function (req, res) {
    Team.aggregate([
      {
        $unwind: { path: '$members', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'userProfiles',
          localField: 'members.userId',
          foreignField: '_id',
          as: 'userProfile',
        },
      },
      {
        $unwind: {
          path: '$userProfile',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            teamId: '$_id',
            // Keep the raw value that worked in Compass
            teamCode: '$userProfile.teamCode',
          },
          count: { $sum: 1 },
          teamName: { $first: '$teamName' },
          members: {
            $push: {
              _id: '$userProfile._id',
              name: '$userProfile.name',
              email: '$userProfile.email',
              teamCode: '$userProfile.teamCode',
              addDateTime: '$members.addDateTime',
            },
          },
          createdDatetime: { $first: '$createdDatetime' },
          modifiedDatetime: { $first: '$modifiedDatetime' },
          isActive: { $first: '$isActive' },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $group: {
          _id: '$_id.teamId',
          teamCode: { $first: '$_id.teamCode' },
          teamName: { $first: '$teamName' },
          members: { $first: '$members' },
          createdDatetime: { $first: '$createdDatetime' },
          modifiedDatetime: { $first: '$modifiedDatetime' },
          isActive: { $first: '$isActive' },
        },
      },
      {
        $sort: { teamName: 1 },
      },
    ])
      .then((results) => {
        // The API now sends an ARRAY, which is what the frontend expects.
        res.status(200).send(results);
      })
      .catch((error) => {
        console.error('Aggregation failed unexpectedly:', error);
        Logger.logException(error);
        res.status(500).send(error);
      });
  };
  const getTeamById = function (req, res) {
    const { teamId } = req.params;

    Team.findById(teamId)
      .then((results) => res.status(200).send(results))
      .catch((error) => {
        Logger.logException(error, null, `teamId: ${teamId}`);
        res.status(404).send(error);
      });
  };

  const postTeam = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'postTeam'))) {
      res.status(403).send({ error: 'You are not authorized to create teams.' });
      return;
    }

    if (await Team.exists({ teamName: req.body.teamName })) {
      res.status(403).send({ error: `Team Name "${req.body.teamName}" already exists` });
      return;
    }

    const team = new Team();
    team.teamName = req.body.teamName;
    team.isActive = req.body.isActive;
    team.createdDatetime = Date.now();
    team.modifiedDatetime = Date.now();

    try {
      const result = await team.save();
      res.status(200).send(result);
    } catch (error) {
      Logger.logException(error, null, `teamName: ${req.body.teamName}`);
      res.status(500).send({ error: INTERNAL_SERVER_ERROR });
    }
  };

  const deleteTeam = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'deleteTeam'))) {
      res.status(403).send({ error: 'You are not authorized to delete teams.' });
      return;
    }
    const { teamId } = req.params;
    Team.findById(teamId, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }
      const removeteamfromprofile = userProfile
        .updateMany({}, { $pull: { teams: record._id } })
        .exec();
      const deleteteam = record.remove();

      Promise.all([removeteamfromprofile, deleteteam])
        .then(
          res.status(200).send({ message: 'Team successfully deleted and user profiles updated' }),
        )
        .catch((catchError) => {
          Logger.logException(error, null, `teamId: ${teamId}`);
          res.status(400).send({ error: catchError });
        });
    });
  };

  const putTeam = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'putTeam'))) {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }

    const { teamId } = req.params;

    Team.findById(teamId, async (error, record) => {
      if (error || record === null) {
        res.status(400).send('No valid records found');
        return;
      }

      // Store the old team code before updating
      const oldTeamCode = record.teamCode;
      const newTeamCode = req.body.teamCode;

      record.teamName = req.body.teamName;
      record.isActive = req.body.isActive;
      record.teamCode = req.body.teamCode;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();

      try {
        const savedTeam = await record.save();

        // If team code changed, update all user profiles that have the old team code
        if (oldTeamCode && newTeamCode && oldTeamCode !== newTeamCode) {
          // Update all user profiles that have the old team code
          await userProfile.updateMany(
            { teamCode: oldTeamCode },
            { $set: { teamCode: newTeamCode } },
          );

          // Clear cache to ensure fresh data is loaded
          if (cache.hasCache('teamCodes')) {
            cache.removeCache('teamCodes');
          }
        }

        res.status(200).send(savedTeam);
      } catch (catchError) {
        Logger.logException(catchError, null, `TeamId: ${teamId} Request:${req.body}`);
        res.status(400).send({ error: catchError });
      }
    });
  };

  const assignTeamToUsers = async function (req, res) {
    // verify requestor is administrator, teamId is passed in request params and is valid mongoose objectid, and request body contains  an array of users

    try {
      if (!(await hasPermission(req.body.requestor, 'assignTeamToUsers'))) {
        res.status(403).send({ error: 'You are not authorized to perform this operation' });
        return;
      }

      const { teamId } = req.params;
      if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
        res.status(400).send({ error: 'Invalid teamId' });
        return;
      }

      // verify team exists
      const targetTeam = await Team.findById(teamId);
      if (!targetTeam || targetTeam.length === 0) {
        res.status(400).send({ error: 'Invalid team' });
        return;
      }

      const { userId, operation } = req.body;
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).send({ error: 'Invalid userId' });
        return;
      }
      // if user's profile is stored in cache, clear it so when you visit their profile page it will be up to date
      if (cache.hasCache(`user-${userId}`)) cache.removeCache(`user-${userId}`);

      if (operation === 'Assign') {
        const alreadyMember = targetTeam.members?.some(
          (m) => m.userId.toString() === userId.toString(),
        );

        if (!alreadyMember) {
          await Team.findByIdAndUpdate(
            teamId,
            {
              $push: {
                members: {
                  userId,
                  visible: true,
                  addDateTime: new Date(),
                },
              },
              $set: { modifiedDatetime: Date.now() },
            },
            { new: true },
          );
        } else {
          console.log('User is already a member of the team, skipping addition to members array.');
        }

        await userProfile.findByIdAndUpdate(
          userId,
          { $addToSet: { teams: teamId } },
          { new: true },
        );

        const updatedMember = await userProfile.findById(userId);
        return res.status(200).send({ newMember: updatedMember });
      }
      if (operation === 'UnAssign') {
        await Team.findByIdAndUpdate(teamId, {
          $pull: { members: { userId } },
          $set: { modifiedDatetime: Date.now() },
        });

        await userProfile.findByIdAndUpdate(userId, { $pull: { teams: teamId } }, { new: true });

        return res.status(200).send({ result: 'Delete Success' });
      }
      return res.status(400).send({ error: 'Invalid operation. Must be "Assign" or "UnAssign".' });
    } catch (error) {
      Logger.logException(
        error,
        null,
        `TeamId: ${req.params?.teamId} Request:${JSON.stringify(req.body)}`,
      );
      res.status(500).send({ error });
    }
  };

  const getTeamMembership = function (req, res) {
    const { teamId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }
    Team.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId(teamId) },
      },
      { $unwind: '$members' },
      {
        $lookup: {
          from: 'userProfiles',
          localField: 'members.userId',
          foreignField: '_id',
          as: 'userProfile',
        },
      },
      { $unwind: '$userProfile' },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [{ addDateTime: '$members.addDateTime' }, '$userProfile'],
          },
        },
      },
    ])
      .then((result) => {
        res.status(200).send(result);
      })
      .catch((error) => {
        Logger.logException(error, null, `TeamId: ${teamId} Request:${req.body}`);
        return res.status(500).send(error);
      });
  };
  const updateTeamVisibility = async (req, res) => {
    const { visibility, teamId, userId } = req.body;

    try {
      Team.findById(teamId, (error, team) => {
        if (error || team === null) {
          res.status(400).send('No valid records found');
          return;
        }

        const memberIndex = team.members.findIndex((member) => member.userId.toString() === userId);
        if (memberIndex === -1) {
          res.status(400).send('Member not found in the team.');
          return;
        }

        team.members[memberIndex].visible = visibility;
        team.modifiedDatetime = Date.now();

        team
          .save()
          .then(() => {
            // Additional operations after team.save()
            const assignlist = [];
            const unassignlist = [];
            team.members.forEach((member) => {
              if (member.userId.toString() === userId) {
                // Current user, no need to process further
                return;
              }

              if (visibility) {
                assignlist.push(member.userId);
              } else {
                console.log('Visiblity set to false so removing it');
                unassignlist.push(member.userId);
              }
            });

            const addTeamToUserProfile = userProfile
              .updateMany({ _id: { $in: assignlist } }, { $addToSet: { teams: teamId } })
              .exec();
            const removeTeamFromUserProfile = userProfile
              .updateMany({ _id: { $in: unassignlist } }, { $pull: { teams: teamId } })
              .exec();

            Promise.all([addTeamToUserProfile, removeTeamFromUserProfile])
              .then(() => {
                res.status(200).send({ result: 'Done' });
              })

              .catch((catchError) => {
                res.status(500).send({ error: catchError });
              });
          })
          .catch((catchError) => {
            console.error('Error saving team:', catchError);
            res.status(400).send(catchError);
          });
      });
    } catch (error) {
      res.status(500).send(`Error updating team visibility: ${error.message}`);
    }
  };

  /**
   * Leaner version of the teamcontroller.getAllTeams
   * Remove redundant data: members, isActive, createdDatetime, modifiedDatetime.
   */
  const getAllTeamCode = async function (req, res) {
    Team.find({ isActive: true }, { teamCode: 1, _id: 1, teamName: 1 })
      .then((results) => {
        res.status(200).send(results);
      })
      .catch(() => {
        // logger.logException(`Fetch team code failed: ${error}`);
        res.status(500).send('Fetch team code failed.');
      });
  };

  const getAllTeamMembers = async function (req, res) {
    try {
      const teamIds = req.body;
      const cacheKey = 'teamMembersCache';
      if (cache.hasCache(cacheKey)) {
        const data = cache.getCache('teamMembersCache');
        return res.status(200).send(data);
      }
      if (
        !Array.isArray(teamIds) ||
        teamIds.length === 0 ||
        !teamIds.every((team) => mongoose.Types.ObjectId.isValid(team._id))
      ) {
        return res.status(400).send({
          error: 'Invalid request: teamIds must be a non-empty array of valid ObjectId strings.',
        });
      }
      const data = await Team.aggregate([
        {
          $match: { _id: { $in: teamIds.map((team) => mongoose.Types.ObjectId(team._id)) } },
        },
        { $unwind: '$members' },
        {
          $lookup: {
            from: 'userProfiles',
            localField: 'members.userId',
            foreignField: '_id',
            as: 'userProfile',
          },
        },
        { $unwind: { path: '$userProfile', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$_id', // Group by team ID
            teamName: { $first: '$teamName' }, // Use $first to keep the team name
            createdDatetime: { $first: '$createdDatetime' },
            members: { $push: '$members' }, // Rebuild the members array
          },
        },
      ]);
      cache.setCache(cacheKey, data);
      res.status(200).send(data);
    } catch {
      console.log('Error in getAllTeamMembers');
      res.status(500).send({ message: 'Fetching team members failed' });
    }
  };
  return {
    getAllTeams,
    getAllTeamCode,
    getTeamById,
    postTeam,
    deleteTeam,
    putTeam,
    assignTeamToUsers,
    getTeamMembership,
    updateTeamVisibility,
    getAllTeamMembers,
  };
};

module.exports = teamcontroller;
