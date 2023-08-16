const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const hasPermission = require('../utilities/permissions');

const teamcontroller = function (Team) {
  const getAllTeams = function (req, res) {
    Team.find({})
      .sort({ teamName: 1 })
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));
  };
  const getTeamById = function (req, res) {
    const { teamId } = req.params;

    Team.findById(teamId)
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));
  };
  const postTeam = function (req, res) {
    const team = new Team();

    team.teamName = req.body.teamName;
    team.isACtive = req.body.isActive;
    team.createdDatetime = Date.now();
    team.modifiedDatetime = Date.now();

    team
      .save()
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));
  };
  const deleteTeam = function (req, res) {
    if (!hasPermission(req.body.requestor.role, 'deleteTeam')) {
      res.status(403).send({ error: 'You are not authorized to delete teams.' });
      return;
    }
    const { teamId } = req.params;
    Team.findById(teamId, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }
      const removeteamfromprofile = userProfile.updateMany({}, { $pull: { teams: record._id } }).exec();
      const deleteteam = record.remove();

      Promise.all([removeteamfromprofile, deleteteam])
        .then(res.status(200).send({ message: ' Team successfully deleted and user profiles updated' }))
        .catch((errors) => {
          res.status(400).send(errors);
        });
    }).catch((error) => {
      res.status(400).send(error);
    });
  };
  const putTeam = function (req, res) {
    if (!hasPermission(req.body.requestor.role, 'putTeam')) {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }

    const { teamId } = req.params;

    Team.findById(teamId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('No valid records found');
        return;
      }
      record.teamName = req.body.teamName;
      record.isActive = req.body.isActive;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();

      record
        .save()
        .then(results => res.status(201).send(results._id))
        .catch(errors => res.status(400).send(errors));
    });
  };

  const assignTeamToUsers = function (req, res) {
    // verify requestor is administrator, teamId is passed in request params and is valid mongoose objectid, and request body contains  an array of users

    if (!hasPermission(req.body.requestor.role, 'assignTeamToUsers')) {
      res.status(403).send({ error: 'You are not authorized to perform this operation' });
      return;
    }

    if (
      !req.params.teamId
      || !mongoose.Types.ObjectId.isValid(req.params.teamId)
      || !req.body.users
      || req.body.users.length === 0
    ) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }

    // verify team exists

    Team.findById(req.params.teamId)
      .then((team) => {
        if (!team || team.length === 0) {
          res.status(400).send({ error: 'Invalid team' });
          return;
        }
        const { users } = req.body;
        const assignlist = [];
        const unassignlist = [];

        users.forEach((element) => {
          const { userId, operation } = element;

          if (operation === 'Assign') {
            assignlist.push(userId);
          } else {
            unassignlist.push(userId);
          }
        });

        const addTeamToUserProfile = userProfile
          .updateMany({ _id: { $in: assignlist } }, { $addToSet: { teams: team._id } })
          .exec();
        const removeTeamFromUserProfile = userProfile
          .updateMany({ _id: { $in: unassignlist } }, { $pull: { teams: team._id } })
          .exec();
        const addUserToTeam = Team.updateOne(
          { _id: team._id },
          { $addToSet: { members: { $each: assignlist.map(userId => ({ userId })) } } },
        ).exec();
        const removeUserFromTeam = Team.updateOne(
          { _id: team._id },
          { $pull: { members: { userId: { $in: unassignlist } } } },
        ).exec();

        Promise.all([addTeamToUserProfile, removeTeamFromUserProfile, addUserToTeam, removeUserFromTeam])
          .then(() => {
            res.status(200).send({ result: 'Done' });
          })
          .catch((error) => {
            res.status(500).send({ error });
          });
      })
      .catch((error) => {
        res.status(500).send({ error });
      });
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
      .then(result => res.status(200).send(result))
      .catch(error => res.status(500).send(error));
  };

  return {
    getAllTeams,
    getTeamById,
    postTeam,
    deleteTeam,
    putTeam,
    assignTeamToUsers,
    getTeamMembership,
  };
};

module.exports = teamcontroller;
