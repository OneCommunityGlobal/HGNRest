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
    const message = await githubService.removeUser(username);  
    await appAccessService.revokeAppAccess(targetUser.targetUserId, 'github');
    res.status(200).json({ message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
};