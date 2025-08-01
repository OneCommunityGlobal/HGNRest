const slackService = require('../../services/automation/slackService'); // Import the Slack service
const { checkAppAccess } = require('./utils');
const appAccessService = require('../../services/automation/appAccessService');

// Controller function to invite a user
async function inviteUser(req, res) {
  const { targetUser } = req.body;
  const { requestor } = req.body;

  // Validate email input
  if (!targetUser.email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  if (!checkAppAccess(requestor.role)) {
    res.status(403).send({ message: 'Unauthorized request' });
    return;
  }

  try {
    await slackService.sendSlackInvite(targetUser.email);
    await appAccessService.upsertAppAccess(targetUser.targetUserId, 'slack', 'invited', targetUser.email);
    return res.status(201).json({ message: `Invitation sent successfully to ${targetUser.email}` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
};

