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
    const invitation = await sentryService.inviteUser(targetUser.email);
    await appAccessService.upsertAppAccess(
      targetUser.targetUserId,
      'sentry',
      'invited',
      targetUser.email,
    );
    res.status(201).json({ message: 'Invitation sent with access to all teams', data: invitation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Controller function to remove a user by email
async function removeUser(req, res) {
  const { targetUser } = req.body;

  if (!targetUser.email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const { requestor } = req.body;

  if (!checkAppAccess(requestor.role)) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  try {
    const members = await sentryService.getMembers();
    const message = await sentryService.removeUser(targetUser.email, members);
    await appAccessService.revokeAppAccess(targetUser.targetUserId, 'sentry');
    res.status(200).json({ message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
};

