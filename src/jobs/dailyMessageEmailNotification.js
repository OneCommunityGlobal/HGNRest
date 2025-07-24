const cron = require('node-cron');
const UserPreferences = require('../models/lbdashboard/userPreferences');
const Message = require('../models/lbdashboard/message');
const UserProfile = require('../models/userProfile');
const emailSender = require('../utilities/emailSender');

const TEST_MODE = true; // Set to false to disable test mode
const TEST_EMAIL = 'test@example.com';

// Schedule the job to run daily at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  try {
    const userPreferences = await UserPreferences.find().populate('user users.userNotifyingFor');

    await Promise.all(
      userPreferences.map(async (preference) => {
        const { user, users } = preference;

        if (!user || !users || users.length === 0) return;

        const summaryParts = await Promise.all(
          users
            .filter(({ notifyEmail }) => notifyEmail)
            .map(async ({ userNotifyingFor }) => {
              try {
                const [unreadMessages, userNotifyingForProfile] = await Promise.all([
                  Message.find({
                    receiver: user._id,
                    sender: userNotifyingFor._id,
                    status: { $ne: 'read' },
                  }),
                  UserProfile.findById(userNotifyingFor._id).select('firstName lastName'),
                ]);

                if (!userNotifyingForProfile || unreadMessages.length === 0) return '';

                const senderName = `${userNotifyingForProfile.firstName} ${userNotifyingForProfile.lastName}`;

                if (unreadMessages.length > 5) {
                  return `<li>${unreadMessages.length} messages from ${senderName}</li>`;
                }

                const messageList = unreadMessages
                  .map(
                    (msg) =>
                      `<li>${msg.content} <span style="color: #888;">(Sent: ${msg.timestamp.toLocaleString()})</span></li>`,
                  )
                  .join('');

                return `<li>${unreadMessages.length} messages from ${senderName}<ul>${messageList}</ul></li>`;
              } catch (innerError) {
                console.error(`Error processing user ${userNotifyingFor._id}:`, innerError);
                return '';
              }
            }),
        );

        const summary = summaryParts.filter(Boolean).join('');

        if (summary) {
          const recipientEmail = TEST_MODE ? TEST_EMAIL : user.email;
          if (!recipientEmail) {
            console.warn(`No email found for user ${user._id}`);
            return;
          }
          await emailSender.sendSummaryNotification(recipientEmail, summary);
          console.log(`Email sent to ${recipientEmail}`);
        }
      }),
    );
  } catch (error) {
    console.error('❌ Error running daily email notification job:', error);
  }
});
