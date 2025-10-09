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

  if (!requestor?.role) {
    return res.status(400).json({ message: 'Requestor role is required' });
  }

  if (!checkAppAccess(requestor.role)) {
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

  if (!requestor?.role) {
    return res.status(400).json({ message: 'Requestor role is required' });
  }

  if (!checkAppAccess(requestor.role)) {
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

module.exports = {
  inviteUser,
  removeUser,
};
