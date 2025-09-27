
const githubService = require('../../services/automation/githubService');
const { checkAppAccess } = require('./utils');
const appAccessService = require('../../services/automation/appAccessService');

async function inviteUser(req, res) {
  const { username, targetUser } = req.body;
  const { requestor } = req.body;
  if (!checkAppAccess(requestor.role)) {
    res.status(403).send({ message: 'Unauthorized request' });
    return;
  }

  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    const message = await githubService.sendInvitation(username);
    await appAccessService.upsertAppAccess(targetUser.targetUserId, 'github', 'invited', username);
    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      throw new Error(`Database update failed: ${dbError.message}`);
    }

    res.status(200).json({ message });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
};
