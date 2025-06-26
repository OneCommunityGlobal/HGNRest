const githubService = require('../../services/automation/githubService');
const { checkAppAccess } = require('./utils');
const appAccessService = require('../../services/automation/appAccessService');

async function inviteUser(req, res) {
  const { username } = req.body;
  const { requestor } = req.body;
  if (!checkAppAccess(requestor.role)) {
    res.status(403).send({ error: 'Unauthorized request' });
    return;
  }

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const message = await githubService.sendInvitation(username); 
    await appAccessService.upsertAppAccess(requestor.requestorId, 'github', 'invited', username);
    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function removeUser(req, res) {
  const { username } = req.body;
  const { requestor } = req.body;
  if (!checkAppAccess(requestor.role)) {
    res.status(403).send({ error: 'Unauthorized request' });
    return;
  }

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const message = await githubService.removeUser(username);  
    await appAccessService.revokeAppAccess(requestor.requestorId, 'github');
    res.status(200).json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
};