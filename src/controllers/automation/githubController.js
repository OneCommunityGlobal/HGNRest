const githubService = require('../../services/userManagementAutomation/githubService');

async function inviteUser(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const message = await githubService.sendInvitation(username);  // Call service to send invitation
    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function removeUser(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const message = await githubService.removeUser(username);  // Call service to remove user
    res.status(200).json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
};
