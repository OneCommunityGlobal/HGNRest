const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const HGNFormResponses = require('../models/hgnFormResponse');
const team = require('../models/team');
const { hasPermission } = require('../utilities/permissions');
const cache = require('../utilities/nodeCache')();
const Logger = require('../startup/logger');

const teamcontroller = function (Team) {
  const getAllTeams = function (req, res) {
    Team.aggregate([
      {
        $unwind: '$members',
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
        $unwind: '$userProfile',
      },
      {
        $match: {
          isActive: true,  
        }
      },
      {
        $group: {
          _id: {
            teamId: '$_id',
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
        $sort: { count: -1 }, // Sort by the most frequent teamCode
      },
      {
        $group: {
          _id: '$_id.teamId',
          teamCode: { $first: '$_id.teamCode' }, // Get the most frequent teamCode
          teamName: { $first: '$teamName' },
          members: { $first: '$members' },
          createdDatetime: { $first: '$createdDatetime' },
          modifiedDatetime: { $first: '$modifiedDatetime' },
          isActive: { $first: '$isActive' },
        },
      },
      {
        $sort: { teamName: 1 }, // Sort teams by name
      },
    ])
      .then((results) => res.status(200).send(results))
      .catch((error) => {
        Logger.logException(error);
        res.status(404).send(error);
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
    if (!(await hasPermission(req.body.requestor, 'postTeam'))) {
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

    // Check if a team with the same name already exists
    Team.findOne({ teamName: team.teamName })
      .then((existingTeam) => {
        if (existingTeam) {
          // If a team with the same name exists, return an error
          res.status(400).send({ error: 'A team with this name already exists' });
        } else {
          // If no team with the same name exists, save the new team
          team
            .save()
            .then((results) => res.send(results).status(200))
            .catch((error) => {
              Logger.logException(error, null, `teamName: ${req.body.teamName}`);
              res.send(error).status(404);
            });
        }
      })
      .catch((error) => {
        Logger.logException(error, null, `teamName: ${req.body.teamName}`);
        res.send(error).status(404);
      });
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
        .catch((errors) => {
          Logger.logException(error, null, `teamId: ${teamId}`);
          res.status(400).send(errors);
        });
    }).catch((error) => {
      Logger.logException(error, null, `teamId: ${teamId}`);
      res.status(400).send(error);
    });
  };

  const putTeam = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'putTeam'))) {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }

    const { teamId } = req.params;

    Team.findById(teamId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('No valid records found');
        return;
      }

      // Removed the permission check as the permission check if done in earlier
      // const canEditTeamCode =
      //   req.body.requestor.role === 'Owner' ||
      //   req.body.requestor.permissions?.frontPermissions.includes('editTeamCode');

      // if (!canEditTeamCode) {
      //   res.status(403).send('You are not authorized to edit team code.');
      //   return;
      // }

      record.teamName = req.body.teamName;
      record.isActive = req.body.isActive;
      record.teamCode = req.body.teamCode;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();

      record
        .save()
        .then((results) => res.status(200).send(results._id))
        .catch((errors) => {
          Logger.logException(errors, null, `TeamId: ${teamId} Request:${req.body}`);
          res.status(400).send(errors);
        });
    });
  };

  const assignTeamToUsers = async function (req, res) {
    // verify requestor is administrator, teamId is passed in request params and is valid mongoose objectid, and request body contains  an array of users

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

    try {
      const { userId, operation } = req.body;

      // if user's profile is stored in cache, clear it so when you visit their profile page it will be up to date
      if (cache.hasCache(`user-${userId}`)) cache.removeCache(`user-${userId}`);

      if (operation === 'Assign') {
        await Team.findOneAndUpdate(
          { _id: teamId },
          { $addToSet: { members: { userId } }, $set: { modifiedDatetime: Date.now() } },
          { new: true },
        );
        const newMember = await userProfile.findOneAndUpdate(
          { _id: userId },
          { $addToSet: { teams: teamId } },
          { new: true },
        );
        res.status(200).send({ newMember });
      } else {
        await Team.findOneAndUpdate(
          { _id: teamId },
          { $pull: { members: { userId } }, $set: { modifiedDatetime: Date.now() } },
        );
        await userProfile.findOneAndUpdate(
          { _id: userId },
          { $pull: { teams: teamId } },
          { new: true },
        );
        res.status(200).send({ result: 'Delete Success' });
      }
    } catch (error) {
      Logger.logException(error, null, `TeamId: ${teamId} Request:${req.body}`);
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
        res.status(200).send(result)
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
          .then((updatedTeam) => {
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
              .catch((error) => {
                res.status(500).send({ error });
              });
          })
          .catch((errors) => {
            console.error('Error saving team:', errors);
            res.status(400).send(errors);
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
      .catch((error) => {
        // logger.logException(`Fetch team code failed: ${error}`);
        res.status(500).send('Fetch team code failed.');
      });
  };

  const getAllTeamMembers = async function (req,res) {
    try{
      const teamIds = req.body;
      const cacheKey='teamMembersCache'
      if(cache.hasCache(cacheKey)){
        let data=cache.getCache('teamMembersCache')
        return res.status(200).send(data);
      }
      if (!Array.isArray(teamIds) || teamIds.length === 0 || !teamIds.every(team => mongoose.Types.ObjectId.isValid(team._id))) {
        return res.status(400).send({ error: 'Invalid request: teamIds must be a non-empty array of valid ObjectId strings.' });
      }
      let data = await Team.aggregate([
        { 
          $match: { _id: { $in: teamIds.map(team => mongoose.Types.ObjectId(team._id)) } } 
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
            _id: '$_id',  // Group by team ID
            teamName: { $first: '$teamName' }, // Use $first to keep the team name
            createdDatetime: { $first: '$createdDatetime' }, 
            members: { $push: '$members' },  // Rebuild the members array
          },
        },
      ])
      cache.setCache(cacheKey,data)
      res.status(200).send(data);
    }catch(error){
      console.log(error)
      res.status(500).send({'message':"Fetching team members failed"});
    }
  };

  const getTeamMembersSkillsAndContact = async function (req, res) {
    try {
      // Get user ID from requestor object added by middleware
      if (!req.body.requestor || !req.body.requestor.requestorId) {
        return res.status(401).send({ message: 'User not authenticated' });
      }
      
      const userId = req.body.requestor.requestorId;
      
      // Get skill parameter
      const skillName = req.params.skill;
      if (!skillName) {
        return res.status(400).send({ message: 'Skill parameter is required' });
      }
      
      // Find the user's team
      const userDoc = await userProfile.findById(userId);
      if (!userDoc) {
        return res.status(404).send({ message: 'User not found' });
      }
      
      // Check if user has any teams
      if (!userDoc.teams || userDoc.teams.length === 0) {
        return res.status(404).send({ message: 'User has no teams' });
      }
      
      const teamId = userDoc.teams[0]; // Use the first team
      
      // Get team details
      const teamDoc = await team.findById(teamId);
      if (!teamDoc || !teamDoc.members || teamDoc.members.length === 0) {
        return res.status(200).send([]);
      }
      
      // Get all member IDs except the current user
      const memberUserIds = teamDoc.members
        .filter(member => member.visible !== false && member.userId.toString() !== userId)
        .map(member => member.userId);
      
      // Get form responses for all team members
      const formResponses = await HGNFormResponses.find({
        user_id: { $in: memberUserIds.map(id => id.toString()) }
      }).lean();
      
      // Map data directly from form responses
      const teamMembersData = formResponses.map(response => {
        let score = 0;
        
        // Check for skill score in frontend or backend
        if (response.frontend && response.frontend[skillName] !== undefined) {
          score = parseInt(response.frontend[skillName], 10) || 0;
        } else if (response.backend && response.backend[skillName] !== undefined) {
          score = parseInt(response.backend[skillName], 10) || 0;
        }
        
        return {
          name: response.userInfo.name,
          email: response.userInfo.email,
          slack: response.userInfo.slack || '',
          rating: `${score} / 10`
        };
      });
      
      // Sort by skill score
      teamMembersData.sort((a, b) => {
        const scoreA = parseInt(a.rating.split(' / ')[0], 10);
        const scoreB = parseInt(b.rating.split(' / ')[0], 10);
        return scoreB - scoreA;
      });
      
      return res.status(200).send(teamMembersData);
      
    } catch (error) {
      console.error('Error in getTeamMembersSkillsAndContact:', error);
      return res.status(500).send({
        message: 'Failed to retrieve team members',
        error: error.message
      });
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
    getTeamMembersSkillsAndContact,
  };
};

module.exports = teamcontroller;
