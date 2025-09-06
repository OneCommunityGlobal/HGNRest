
const sentryService = require('../../services/automation/sentryService');

const appAccessService = require('../../services/automation/appAccessService');
const { checkAppAccess } = require('./utils');

// Controller function to invite a user
async function inviteUser(req, res) {
  const { targetUser } = req.body;

  if (!targetUser.email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const { requestor } = req.body;
  if (!checkAppAccess(requestor.role)) {
    res.status(403).send({ message: 'Unauthorized request' });
    return;
  }

  try {
    // Step 1: Send invitation to Sentry
    const invitation = await sentryService.inviteUser(targetUser.email);

    // Step 2: Only update internal records if Sentry operation succeeded
    await appAccessService.upsertAppAccess(
      targetUser.targetUserId,
      'sentry',
      'invited',
      targetUser.email,
    );

    res.status(201).json({
      message: 'Invitation sent with access to all teams',
      data: invitation,
    });
  } catch (error) {
    // Simple error handling based on HTTP status codes
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ message: error.message });
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
      throw new Error(`Database update failed: ${dbError.message}`);
    }

    const responseMessage = `Complete revocation (undid invite): ${result.message}`;
    res.status(200).json({
      message: responseMessage,
      data: {
        userEmail: result.userEmail,
        memberId: result.memberId,
        teamsRemoved: result.teamsRemoved,
        totalTeams: result.totalTeams,
      },
    });
  } catch (error) {
    // Simple error handling based on HTTP status codes
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
};
