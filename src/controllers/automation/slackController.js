const slackService = require('../../services/automation/slackService'); // Import the Slack service
const { checkAppAccess } = require('./utils');
const appAccessService = require('../../services/automation/appAccessService');

// Controller function to invite a user
async function inviteUser(req, res) {
  const { email } = req.body;
  const { requestor } = req.body;
  // Validate email input
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!checkAppAccess(requestor.role)) {
    res.status(403).send({ error: 'Unauthorized request' });
    return;
  }

  try {
    await slackService.sendSlackInvite(email);
    await appAccessService.upsertAppAccess(requestor.requestorId, 'slack', 'invited', email);
    return res.status(201).json({ message: `Invitation sent successfully to ${email}` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  inviteUser,
};

