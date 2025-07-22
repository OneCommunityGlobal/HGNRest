const cron = require('node-cron');
const UserPreferences = require('../models/lbdashboard/userPreferences');
const Message = require('../models/lbdashboard/message');
const UserProfile = require('../models/userProfile');
const emailSender = require('../utilities/emailSender');

// Set test mode and test email
const TEST_MODE = true; // Set to false to disable test mode
const TEST_EMAIL = 'test@example.com';

// Schedule the job to run daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const userPreferences = await UserPreferences.find().populate('user users.userNotifyingFor');

    await Promise.all(
      userPreferences.map(async (preference) => {
        const { user, users } = preference;

        const summaryParts = await Promise.all(
          users.map(async ({ userNotifyingFor, notifyEmail }) => {
            if (!notifyEmail) return '';

            const [unreadMessages, userNotifyingForProfile] = await Promise.all([
              Message.find({
                receiver: user._id,
                sender: userNotifyingFor._id,
                status: { $ne: 'read' },
              }),
              UserProfile.findById(userNotifyingFor._id).select('firstName lastName'),
            ]);

            if (unreadMessages.length === 0) return '';

            if (unreadMessages.length > 5) {
              return `<li>${unreadMessages.length} messages from ${userNotifyingForProfile.firstName} ${userNotifyingForProfile.lastName}</li>`;
            }
            const messageList = unreadMessages
              .map(
                (msg) =>
                  `<li>${msg.content} <span style="color: #888;">(Sent: ${msg.timestamp.toLocaleString()})</span></li>`,
              )
              .join('');
            return `<li>${unreadMessages.length} messages from ${userNotifyingForProfile.firstName} ${userNotifyingForProfile.lastName}<ul>${messageList}</ul></li>`;
          }),
        );

        const summary = summaryParts.filter(Boolean).join('');
        if (summary) {
          const recipientEmail = TEST_MODE ? TEST_EMAIL : user.email;
          await emailSender.sendSummaryNotification(recipientEmail, summary);
        }
      }),
    );
  } catch (error) {
    console.error('❌ Error running daily email notification job:', error);
  }
});
