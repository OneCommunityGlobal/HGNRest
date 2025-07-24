const cron = require('node-cron');
const UserPreferences = require('../models/lbdashboard/userPreferences');
const Message = require('../models/lbdashboard/message');
const UserProfile = require('../models/userProfile');
const emailSender = require('../utilities/emailSender');

const TEST_MODE = true; // Set to false to disable test mode
const TEST_EMAIL = 'test@example.com';

cron.schedule('0 0 * * *', async () => {
  console.log('Starting daily email notification job...');
  try {
    const userPreferences = await UserPreferences.find().populate('user users.userNotifyingFor');

    await Promise.all(
      userPreferences.map(async (preference) => {
        const { user, users } = preference;
        if (!user || !users || users.length === 0) return;

        let summary = '';

        const userPromises = users
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

              if (!userNotifyingForProfile || unreadMessages.length === 0) return;

              const senderName = `${userNotifyingForProfile.firstName} ${userNotifyingForProfile.lastName}`;

              if (unreadMessages.length > 5) {
                summary += `<li>${unreadMessages.length} messages from ${senderName}</li>`;
              } else {
                const messageList = unreadMessages
                  .map(
                    (msg) =>
                      `<li>${msg.content} <span style="color: #888;">(Sent: ${msg.timestamp.toLocaleString()})</span></li>`,
                  )
                  .join('');
                summary += `<li>${unreadMessages.length} messages from ${senderName}<ul>${messageList}</ul></li>`;
              }
            } catch (err) {
              console.error(`Error processing user ${userNotifyingFor._id}:`, err);
            }
          });

        await Promise.all(userPromises);

        if (summary) {
          const recipientEmail = TEST_MODE ? TEST_EMAIL : user.email;
          if (recipientEmail) {
            await emailSender.sendSummaryNotification(recipientEmail, summary);
            console.log(`Email sent to ${recipientEmail}`);
          } else {
            console.warn(`No email found for user ${user._id}`);
          }
        }
      }),
    );
  } catch (error) {
    console.error('❌ Error running daily email notification job:', error);
  }
});
