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

    for (const preference of userPreferences) {
      const { user, users } = preference;

      let summary = '';
      for (const { userNotifyingFor, notifyEmail } of users) {
        if (notifyEmail) {
          // Fetch unread messages from the specific sender
          const unreadMessages = await Message.find({
            receiver: user._id,
            sender: userNotifyingFor._id,
            status: { $ne: 'read' },
          });

          const userNotifyingForProfile = await UserProfile.findById(userNotifyingFor._id).select('firstName lastName');

          if (unreadMessages.length > 0) {
            if (unreadMessages.length > 5) {
              summary += `<li>${unreadMessages.length} messages from ${userNotifyingForProfile.firstName} ${userNotifyingForProfile.lastName}</li>`;
            } else {
              const messageList = unreadMessages
                .map((msg) => `<li>${msg.content} <span style="color: #888;">(Sent: ${msg.timestamp.toLocaleString()})</span></li>`)
                .join('');
              summary += `<li>${unreadMessages.length} messages from ${userNotifyingForProfile.firstName} ${userNotifyingForProfile.lastName}<ul>${messageList}</ul></li>`;
            }
          }
        }
      }

      if (summary) {
        const recipientEmail = TEST_MODE ? TEST_EMAIL : user.email;
        await emailSender.sendSummaryNotification(recipientEmail, summary);
      }
    }
  } catch (error) {
    console.error('❌ Error running daily email notification job:', error);
  }
});