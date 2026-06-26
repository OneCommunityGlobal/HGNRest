const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const HGNFormResponses = require('../models/hgnFormResponse');
const team = require('../models/team');
const { hasPermission } = require('../utilities/permissions');
const cache = require('../utilities/nodeCache')();
const Logger = require('../startup/logger');
const helper = require('../utilities/permissions');

const INTERNAL_SERVER_ERROR = 'Internal server error';

const teamcontroller = function (Team) {
  const getAllTeams = function (req, res) {
    Team.aggregate([
      {
        // Unwind members so each member becomes its own document.
        // preserveNullAndEmptyArrays keeps teams with no members.
        $unwind: { path: '$members', preserveNullAndEmptyArrays: true },
      },
      {
        // Join each member's userId to their userProfile to get email, teamCode etc.
        $lookup: {
          from: 'userProfiles',
          localField: 'members.userId',
          foreignField: '_id',
          as: 'userProfile',
        },
      },
      {
        // Flatten the single-element userProfile array.
        // preserveNullAndEmptyArrays keeps members whose userProfile was deleted.
        $unwind: {
          path: '$userProfile',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        // Re-group by teamId only — NOT by userProfile.teamCode.
        // The previous two-stage group (teamId + teamCode → teamId) was
        // silently dropping members whose teamCode differed from the majority,
        // because $first in the second group only kept one bucket's members.
        $group: {
          _id: '$_id',
          teamCode: { $first: '$teamCode' },
          teamName: { $first: '$teamName' },
          isActive: { $first: '$isActive' },
          createdDatetime: { $first: '$createdDatetime' },
          modifiedDatetime: { $first: '$modifiedDatetime' },
          members: {
            $push: {
              _id: '$userProfile._id',
              email: '$userProfile.email',
              teamCode: '$userProfile.teamCode',
              addDateTime: '$members.addDateTime',
              visible: '$members.visible',
            },
          },
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

    const newTeam = new Team();
    newTeam.teamName = req.body.teamName;
    newTeam.isActive = req.body.isActive;
    newTeam.createdDatetime = Date.now();
    newTeam.modifiedDatetime = Date.now();

    try {
      const result = await newTeam.save();
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
      const newTeamCode = req.body.teamCode || '';

      record.teamName = req.body.teamName;
      record.isActive = req.body.isActive;
      record.teamCode = newTeamCode;
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

    console.log('\n=== updateTeamVisibility called ===');
    console.log('teamId    :', teamId);
    console.log('userId    :', userId);
    console.log('visibility:', visibility);

    try {
      const teamDoc = await Team.findById(teamId);
      if (!teamDoc) {
        console.log('ERROR: No team found for teamId:', teamId);
        return res.status(400).send({ error: 'No valid records found' });
      }

      console.log('Team found:', teamDoc.teamName);
      console.log(
        'Team.members array:',
        JSON.stringify(
          teamDoc.members.map((m) => ({
            userId: m.userId ? m.userId.toString() : null,
            visible: m.visible,
          })),
          null,
          2,
        ),
      );

      const memberIndex = teamDoc.members.findIndex(
        (member) => member.userId.toString() === userId,
      );

      console.log('memberIndex:', memberIndex);

      if (memberIndex === -1) {
        console.log(
          'ERROR: userId',
          userId,
          'NOT found in Team.members.',
          '\nAll member userIds:',
          teamDoc.members.map((m) => m.userId.toString()),
        );
        return res.status(400).send({ error: 'Member not found in the team.' });
      }

      console.log(
        'Member found at index',
        memberIndex,
        ':',
        JSON.stringify(teamDoc.members[memberIndex]),
      );

      // Persist the new visibility flag on the Team document.
      // This controls what the admin UI shows (the toggle state).
      teamDoc.members[memberIndex].visible = visibility;
      teamDoc.modifiedDatetime = Date.now();
      await teamDoc.save();
      console.log('Team saved successfully. visible =', visibility, 'for userId', userId);

      // Enforce visibility by controlling what appears in the toggled user's
      // own userProfile.teams array.
      //
      // The app resolves "who can I see?" by looking up which teams are listed
      // in the logged-in user's userProfile.teams. So:
      //   - visible ON  → add teamId back to the toggled user's profile so they
      //                   can see their teammates again.
      //   - visible OFF → remove teamId from the toggled user's profile so the
      //                   team's members disappear from their view.
      //
      // Other members are NOT touched — their ability to see this user is
      // unaffected by this toggle (asymmetric by design).
      //
      // NOTE: Elevated roles (Owner, Admin, Core Team) are NOT blocked here.
      // The toggle can be saved for anyone. The role-based override belongs on
      // the READ side — i.e. the endpoint that fetches what a logged-in user
      // can see should ignore the teams filter for elevated roles.
      if (visibility) {
        await userProfile.findByIdAndUpdate(userId, { $addToSet: { teams: teamId } });
      } else {
        await userProfile.findByIdAndUpdate(userId, { $pull: { teams: teamId } });
      }

      return res.status(200).send({ result: 'Done' });
    } catch (error) {
      return res.status(500).send(`Error updating team visibility: ${error.message}`);
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
      // from the frontend in totalReports comp they are sending only array of teamids not any obj so changed team._id to team
      if (
        !Array.isArray(teamIds) ||
        teamIds.length === 0 ||
        !teamIds.every((teamId) => mongoose.Types.ObjectId.isValid(teamId))
      ) {
        return res.status(400).send({
          error: 'Invalid request: teamIds must be a non-empty array of valid ObjectId strings.',
        });
      }
      const data = await Team.aggregate([
        {
          $match: { _id: { $in: teamIds.map((teamId) => mongoose.Types.ObjectId(teamId)) } },
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
      res.status(500).send({ message: 'Fetching team members failed' });
    }
  };

  const getTeamMembersSkillsAndContact = async function (req, res) {
    try {
      // Get user ID
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
        .filter((member) => member.visible !== false && member.userId.toString() !== userId)
        .map((member) => member.userId);

      // Get user profiles to get privacy settings
      const memberProfiles = await userProfile
        .find({
          _id: { $in: memberUserIds },
        })
        .select('_id email phoneNumber privacySettings')
        .lean();

      // Get form responses for all team members
      const formResponses = await HGNFormResponses.find({
        user_id: { $in: memberUserIds.map((id) => id.toString()) },
      }).lean();

      // Create a map of user profiles by ID for faster lookup
      const profileMap = memberProfiles.reduce((map, profile) => {
        map[profile._id.toString()] = profile;
        return map;
      }, {});

      // Map data with privacy considerations
      const teamMembersData = formResponses
        .map((response) => {
          const profile = profileMap[response.user_id];

          if (!profile) {
            return null;
          }

          let score = 0;

          // Check for skill score in frontend or backend
          if (response.frontend && response.frontend[skillName] !== undefined) {
            score = parseInt(response.frontend[skillName], 10) || 0;
          } else if (response.backend && response.backend[skillName] !== undefined) {
            score = parseInt(response.backend[skillName], 10) || 0;
          }

          // Apply privacy settings
          const email = profile.privacySettings?.email === false ? null : profile.email;

          // Get phone number with privacy consideration
          let phoneNumber = null;
          if (profile.privacySettings?.phoneNumber !== false) {
            if (profile.phoneNumber && profile.phoneNumber.length > 0) {
              const [firstPhoneNumber] = profile.phoneNumber;
              phoneNumber = firstPhoneNumber;
            }
          }

          return {
            name: response.userInfo.name,
            email,
            phoneNumber,
            slack: response.userInfo.slack,
            rating: `${score} / 10`,
          };
        })
        .filter((item) => item !== null);

      // Sort by skill score
      const sortedData = [...teamMembersData].sort((a, b) => {
        const scoreA = parseInt(a.rating.split(' / ')[0], 10);
        const scoreB = parseInt(b.rating.split(' / ')[0], 10);
        return scoreB - scoreA;
      });

      return res.status(200).send(sortedData);
    } catch (error) {
      console.error('Error in getTeamMembersSkillsAndContact:', error);
      return res.status(500).send({
        message: 'Failed to retrieve team members',
        error: error.message,
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
