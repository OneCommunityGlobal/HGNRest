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
  console.log('🔄 Starting daily email notification job...');
  try {
    const userPreferences = await UserPreferences.find().populate('user users.userNotifyingFor');
    console.log(`📊 Processing ${userPreferences.length} user preferences`);

    await Promise.all(
      userPreferences.map(async (preference) => {
        try {
          const { user, users } = preference;

          if (!user || !users) {
            console.warn('Invalid preference structure:', preference._id);
            return;
          }

          const summaryParts = await Promise.all(
            users.map(async ({ userNotifyingFor, notifyEmail }) => {
              if (!notifyEmail) return '';

              try {
                const [unreadMessages, userNotifyingForProfile] = await Promise.all([
                  Message.find({
                    receiver: user._id,
                    sender: userNotifyingFor._id,
                    status: { $ne: 'read' },
                  }),
                  UserProfile.findById(userNotifyingFor._id).select('firstName lastName'),
                ]);

                if (unreadMessages.length === 0) return '';

                // Handle case where user profile might not exist
                if (!userNotifyingForProfile) {
                  console.warn(`User profile not found for ID: ${userNotifyingFor._id}`);
                  return '';
                }

                const senderName = `${userNotifyingForProfile.firstName} ${userNotifyingForProfile.lastName}`;

                if (unreadMessages.length > 5) {
                  return `<li>${unreadMessages.length} messages from ${senderName}</li>`;
                }
                const messageList = unreadMessages
                  .map((msg) => {
                    const content = msg.content || 'No content';
                    const timestamp = msg.timestamp
                      ? msg.timestamp.toLocaleString()
                      : 'Unknown time';
                    return `<li>${content} <span style='color: #888;'>(Sent: ${timestamp})</span></li>`;
                  })
                  .join('');
                return `<li>${unreadMessages.length} messages from ${senderName}<ul>${messageList}</ul></li>`;
              } catch (error) {
                console.error(`Error processing user ${userNotifyingFor._id}:`, error);
                return '';
              }
            }),
          );

          const summary = summaryParts.filter(Boolean).join('');
          if (summary) {
            try {
              const recipientEmail = TEST_MODE ? TEST_EMAIL : user.email;
              if (!recipientEmail) {
                console.warn(`No email found for user ${user._id}`);
                return;
              }
              await emailSender.sendSummaryNotification(recipientEmail, summary);
              console.log(`Email sent successfully to ${recipientEmail}`);
            } catch (emailError) {
              console.error(`Failed to send email to user ${user._id}:`, emailError);
            }
          }
        } catch (preferenceError) {
          console.error(`Error processing preference ${preference._id}:`, preferenceError);
        }
      }),
    );

    console.log('Daily email notification job completed successfully');
  } catch (error) {
    console.error('Error running daily email notification job:', error);
    console.error('Stack trace:', error.stack);
  }
});
