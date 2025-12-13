const sentryService = require('../../services/automation/sentryService');
const appAccessService = require('../../services/automation/appAccessService');
const { checkAppAccess } = require('./utils');

// Controller function to invite a user
async function inviteUser(req, res) {
  const { targetUser, requestor } = req.body;

  if (!targetUser?.email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  if (!targetUser?.targetUserId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  if (!requestor) {
    return res.status(400).json({ message: 'Requestor is required' });
  }

  if (!(await checkAppAccess(requestor))) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  try {
    // First, send the Sentry invitation
    const invitation = await sentryService.inviteUser(targetUser.email);

    // Only update database if Sentry invitation was successful
    try {
      await appAccessService.upsertAppAccess(
        targetUser.targetUserId,
        'sentry',
        'invited',
        targetUser.email,
      );

      return res.status(201).json({
        message: 'Invitation sent with access to all teams',
        data: {
          email: targetUser.email,
          userId: targetUser.targetUserId,
          invitationId: invitation.invitationId,
          teamsAssigned: invitation.teamsAssigned,
        },
      });
    } catch (dbError) {
      // Rollback: attempt to remove the Sentry invitation if DB update fails
      try {
        await sentryService.removeUser(targetUser.email);
      } catch (rollbackError) {
        // Log rollback failure but don't throw - we want to report the original DB error
        console.error('Failed to rollback Sentry invitation:', rollbackError.message);
      }
      const dbUpdateError = new Error(
        `Database update failed after successful Sentry invitation: ${dbError.message}`,
      );
      dbUpdateError.name = 'DatabaseError';
      dbUpdateError.statusCode = 500;
      throw dbUpdateError;
    }
  } catch (error) {
    // Use the error's statusCode if available, otherwise default to 500
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
}

// Controller function to remove a user by email
async function removeUser(req, res) {
  const { targetUser, requestor } = req.body;

  if (!targetUser?.targetUserId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  if (!requestor) {
    return res.status(400).json({ message: 'Requestor is required' });
  }

  if (!(await checkAppAccess(requestor))) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  try {
    // Step 1: Get the stored email from database (the email used when inviting)
    let emailToUse;
    try {
      emailToUse = await appAccessService.getAppCredentials(targetUser.targetUserId, 'sentry');
    } catch (credentialError) {
      throw new Error('Sentry access not found for this user. They may not have been invited.');
    }

    // Step 2: Remove from Sentry using the email
    const result = await sentryService.removeUser(emailToUse);

    // Step 3: Only update internal records if Sentry operation succeeded
    try {
      await appAccessService.revokeAppAccess(targetUser.targetUserId, 'sentry');
    } catch (dbError) {
      const dbUpdateError = new Error(`Database update failed: ${dbError.message}`);
      dbUpdateError.name = 'DatabaseError';
      dbUpdateError.statusCode = 500;
      throw dbUpdateError;
    }

    const responseMessage = `Complete revocation (undid invite): ${result.message}`;
    return res.status(200).json({
      message: responseMessage,
      data: {
        userEmail: result.userEmail,
        memberId: result.memberId,
        teamsRemoved: result.teamsRemoved,
        totalTeams: result.totalTeams,
        userId: targetUser.targetUserId,
      },
    });
  } catch (error) {
    // Use the error's statusCode if available, otherwise default to 500
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
}

// Get detailed user information from Sentry
async function getUserDetails(req, res) {
  const { targetUser, requestor } = req.body;

  // 1. Authorization check
  if (!requestor) {
    return res.status(400).json({ message: 'Requestor is required' });
  }

  if (!(await checkAppAccess(requestor))) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  if (!targetUser?.targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required' });
  }

  try {
    // 2. Database validation - get actual credentials and verify access
    let appAccess;
    try {
      appAccess = await appAccessService.getAppAccess(targetUser.targetUserId, 'sentry');
    } catch (error) {
      return res.status(404).json({
        message: 'No Sentry access found for this user. They may not have been invited.',
      });
    }

    // 3. Status validation - only allow invited apps
    if (appAccess.status !== 'invited') {
      return res.status(403).json({
        message: `Cannot view details for ${appAccess.status} Sentry access. Only invited access can be viewed.`,
      });
    }

    // 4. Use verified credentials from database
    const verifiedEmail = appAccess.credentials;
    const userDetails = await sentryService.getUserDetails(verifiedEmail);

    // Return essential details only: name, status, org, org role, teams with roles
    const essentialDetails = {
      Email: verifiedEmail,
      Name: userDetails.name,
      'User Status': userDetails.status,
      'Organization Role': userDetails.organizationRole,
      Teams:
        userDetails.teams && userDetails.teams.length > 0
          ? userDetails.teams.map((team) => team.name).join(', ')
          : 'No teams assigned',
    };

    // Only add organization if it comes from API
    if (userDetails.organizationName) {
      essentialDetails.Organization = userDetails.organizationName;
    }

    return res.status(200).json({
      message: 'Sentry user details retrieved successfully',
      data: essentialDetails,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
  getUserDetails,
};