const { constants } = require('buffer');
// services/slackService.js
const emailSender = require('../../utilities/emailSender'); // Import your existing email service

// Service function to send a Slack invite email
const sendSlackInvite = async (recipientEmail) => {
  const slackWorkspaceUrl = process.env.SLACK_WORKSPACE_URL; // Slack workspace invite URL from environment variable
  if (!slackWorkspaceUrl) {
    throw new Error('Slack workspace URL is not set in the environment variables');
  }

  const subject = "You're Invited to Join Our Slack Workspace!";
  const message = `
    <h1>Welcome!</h1>
    <p>You've been invited to join our Slack workspace. Click the link below to get started:</p>
    <p><a href="${slackWorkspaceUrl}">Join Our Slack Workspace</a></p>
    <p>If you have any questions, feel free to reach out to us!</p>
  `;

  // Send the email using your existing emailSender function
  await emailSender([recipientEmail], subject, message);
};

module.exports = { sendSlackInvite };
