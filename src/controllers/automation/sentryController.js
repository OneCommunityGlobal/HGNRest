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
    // console.error(`[SENTRY CONTROLLER] ❌ Invite failed for ${targetUser.email}:`, error.message);

    // Simple error handling based on HTTP status codes
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

// Controller function to remove a user by email
async function removeUser(req, res) {
  // console.log(
  //   `[SENTRY CONTROLLER] 🗑️ Remove request received for user ID: ${req.body.targetUser?.targetUserId}`,
  // );

  const { targetUser, requestor } = req.body;

  if (!targetUser?.targetUserId) {
    // console.error(`[SENTRY CONTROLLER] ❌ User ID is required`);
    return res.status(400).json({ message: 'User ID is required' });
  }

  if (!requestor?.role) {
    // console.error(`[SENTRY CONTROLLER] ❌ Requestor role is required`);
    return res.status(400).json({ message: 'Requestor role is required' });
  }

  if (!checkAppAccess(requestor.role)) {
    // console.error(`[SENTRY CONTROLLER] ❌ Unauthorized request from role: ${requestor.role}`);
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  // console.log(`[SENTRY CONTROLLER] ✅ Authorization check passed for role: ${requestor.role}`);

  try {
    // console.log(`[SENTRY CONTROLLER] 🔄 Step 1: Getting stored email from database...`);
    // Step 1: Get the stored email from database (the email used when inviting)
    let emailToUse;
    try {
      emailToUse = await appAccessService.getAppCredentials(targetUser.targetUserId, 'sentry');
      // console.log(`[SENTRY CONTROLLER] ✅ Found stored email: ${emailToUse}`);
    } catch (credentialError) {
      // console.error(
      //   `[SENTRY CONTROLLER] ❌ Sentry access not found for user ID: ${targetUser.targetUserId}`,
      // );
      throw new Error('Sentry access not found for this user. They may not have been invited.');
    }

    // console.log(`[SENTRY CONTROLLER] 🔄 Step 2: Removing user from Sentry...`);
    // Step 2: Remove from Sentry using the email
    const result = await sentryService.removeUser(emailToUse);

    // console.log(`[SENTRY CONTROLLER] 🔄 Step 3: Updating internal records...`);
    // Step 3: Only update internal records if Sentry operation succeeded
    try {
      await appAccessService.revokeAppAccess(targetUser.targetUserId, 'sentry');
      // console.log(`[SENTRY CONTROLLER] ✅ Internal records updated successfully`);
    } catch (dbError) {
      // console.error(`[SENTRY CONTROLLER] ❌ Database update failed: ${dbError.message}`);
      throw new Error(`Database update failed: ${dbError.message}`);
    }

    const responseMessage = `Complete revocation (undid invite): ${result.message}`;
    // console.log(`[SENTRY CONTROLLER] 🎉 Remove process completed successfully for: ${emailToUse}`);
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
    // console.error(
    //   `[SENTRY CONTROLLER] ❌ Remove failed for user ${targetUser.targetUserId}:`,
    //   error.message,
    // );

    // Simple error handling based on HTTP status codes
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
};

