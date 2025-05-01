const slackService = require('../../services/automation/slackService'); // Import the Slack service

// Controller function to invite a user
async function inviteUser(req, res) {
  const { email } = req.body;
  const { requestor } = req.body;
  // Validate email input
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (
    requestor.requestorId !== userId &&
    (requestor.role !== 'Administrator' || requestor.role !== 'Owner')
  ) {
    res.status(403).send({ error: 'Unauthorized request' });
    return;
  }

  try {
    // Call the Slack service to send the invitation email
    await slackService.sendSlackInvite(email);
    return res.status(201).json({ message: 'Invitation sent successfully to ' + email });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  inviteUser,
};

