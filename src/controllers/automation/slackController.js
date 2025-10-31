const slackService = require('../../services/automation/slackService'); // Import the Slack service
const { checkAppAccess } = require('./utils');
const appAccessService = require('../../services/automation/appAccessService');

// Email validation function
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required and must be a string' };
  }

  // Trim whitespace
  email = email.trim();

  if (email.length === 0) {
    return { isValid: false, error: 'Email cannot be empty' };
  }

  if (email.length > 254) {
    return { isValid: false, error: 'Email is too long (maximum 254 characters)' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true, email };
}

// Controller function to invite a user
async function inviteUser(req, res) {
  const { targetUser } = req.body;
  const { requestor } = req.body;

  // Validate requestor
  if (!(await checkAppAccess(requestor))) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  // Validate target user
  if (!targetUser || !targetUser.targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required' });
  }

  // Validate email input
  const emailValidation = validateEmail(targetUser.email);
  if (!emailValidation.isValid) {
    return res.status(400).json({ message: emailValidation.error });
  }

  try {
    // Attempt to send Slack invite
    await slackService.sendSlackInvite(emailValidation.email);

    // If email sent successfully, update database
    await appAccessService.upsertAppAccess(
      targetUser.targetUserId,
      'slack',
      'invited',
      emailValidation.email,
    );

    return res
      .status(201)
      .json({ message: `Invitation sent successfully to ${emailValidation.email}` });
  } catch (error) {
    console.error('Slack invite error:', error);
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  inviteUser,
};
