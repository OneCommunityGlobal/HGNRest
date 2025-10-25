const githubService = require('../../services/automation/githubService');
const { checkAppAccess } = require('./utils');
const appAccessService = require('../../services/automation/appAccessService');

async function inviteUser(req, res) {
  const { username, targetUser, teamIds = [] } = req.body;
  const { requestor } = req.body;
  if (!checkAppAccess(requestor.role)) {
    res.status(403).send({ message: 'Unauthorized request' });
    return;
  }

  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    // First, send the GitHub invitation with teams (default role: direct_member)
    const message = await githubService.sendInvitation(username, 'direct_member', teamIds);

    // Only update database if GitHub invitation was successful
    try {
      await appAccessService.upsertAppAccess(
        targetUser.targetUserId,
        'github',
        'invited',
        username,
      );
      res.status(201).json({ message });
    } catch (dbError) {
      // Rollback: attempt to remove the GitHub invitation if DB update fails
      try {
        await githubService.removeUser(username);
      } catch (rollbackError) {
        // Log rollback failure but don't throw - we want to report the original DB error
        console.error('Failed to rollback GitHub invitation:', rollbackError.message);
      }
      const dbUpdateError = new Error(
        `Database update failed after successful GitHub invitation: ${dbError.message}`,
      );
      dbUpdateError.name = 'DatabaseError';
      dbUpdateError.statusCode = 500;
      throw dbUpdateError;
    }
  } catch (error) {
    // Use the error's statusCode if available, otherwise default to 500
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function removeUser(req, res) {
  const { targetUser, requestor } = req.body;

  if (!targetUser?.targetUserId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  if (!requestor?.role) {
    return res.status(400).json({ message: 'Requestor role is required' });
  }

  if (!checkAppAccess(requestor.role)) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  try {
    // Step 1: Get the stored username from database (the username used when inviting)
    let usernameToUse;
    try {
      usernameToUse = await appAccessService.getAppCredentials(targetUser.targetUserId, 'github');
    } catch (credentialError) {
      throw new Error('GitHub access not found for this user. They may not have been invited.');
    }

    // Step 2: Remove from GitHub using the username
    const message = await githubService.removeUser(usernameToUse);

    // Step 3: Only update internal records if GitHub operation succeeded
    try {
      await appAccessService.revokeAppAccess(targetUser.targetUserId, 'github');
    } catch (dbError) {
      const dbUpdateError = new Error(`Database update failed: ${dbError.message}`);
      dbUpdateError.name = 'DatabaseError';
      dbUpdateError.statusCode = 500;
      throw dbUpdateError;
    }

    res.status(200).json({ message });
  } catch (error) {
    // Use the error's statusCode if available, otherwise default to 500
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

// Get detailed user information from GitHub
async function getUserDetails(req, res) {
  const { targetUser, requestor } = req.body;

  // 1. Authorization check
  if (!requestor?.role) {
    return res.status(400).json({ message: 'Requestor role is required' });
  }

  if (!checkAppAccess(requestor.role)) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  if (!targetUser?.targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required' });
  }

  try {
    // 2. Database validation - get actual credentials and verify access
    let appAccess;
    try {
      appAccess = await appAccessService.getAppAccess(targetUser.targetUserId, 'github');
    } catch (error) {
      return res.status(404).json({
        message: 'No GitHub access found for this user. They may not have been invited.',
      });
    }

    // 3. Status validation - only allow invited apps
    if (appAccess.status !== 'invited') {
      return res.status(403).json({
        message: `Cannot view details for ${appAccess.status} GitHub access. Only invited access can be viewed.`,
      });
    }

    // 4. Use verified credentials from database
    const verifiedUsername = appAccess.credentials;
    const userDetails = await githubService.getUserDetails(verifiedUsername);

    // Return minimal essential details only - focus on One Community org
    const essentialDetails = {
      'GitHub Username': verifiedUsername,
      'Display Name': userDetails.name,
      'Organization Role': userDetails.organizationRole,
      'Member Status': userDetails.status,
      Teams:
        userDetails.teams && userDetails.teams.length > 0
          ? userDetails.teams.join(', ')
          : 'No teams assigned',
    };

    return res.status(200).json({
      message: 'GitHub user details retrieved successfully',
      data: essentialDetails,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
}

// Get available teams in the organization
async function getTeams(req, res) {
  const { requestor } = req.body;

  if (!requestor?.role) {
    return res.status(400).json({ message: 'Requestor role is required' });
  }

  if (!checkAppAccess(requestor.role)) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  try {
    const teams = await githubService.getTeams();
    res.status(200).json({
      message: 'Teams retrieved successfully',
      data: teams,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
  getUserDetails,
  getTeams,
};
