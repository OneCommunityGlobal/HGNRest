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

    // Process all preferences concurrently
    await Promise.all(
      userPreferences.map(async (preference) => {
        const { user, users } = preference;

        // Process all users for this preference concurrently
        const summaryParts = await Promise.all(
          users
            .filter(({ notifyEmail }) => notifyEmail)
            .map(async ({ userNotifyingFor }) => {
              // Fetch unread messages and user profile concurrently
              const [unreadMessages, userNotifyingForProfile] = await Promise.all([
                Message.find({
                  receiver: user._id,
                  sender: userNotifyingFor._id,
                  status: { $ne: 'read' },
                }),
                UserProfile.findById(userNotifyingFor._id).select('firstName lastName'),
              ]);

              // Return summary part for this user (you'll need to complete this logic)
              return { unreadMessages, userNotifyingForProfile };
            }),
        );

        // Combine summary parts and send email
        // Example: Use summaryParts in your email logic
        await emailSender.sendEmail({
          to: TEST_MODE ? TEST_EMAIL : user.email,
          subject: 'Daily Message Summary',
          text: `You have ${summaryParts.reduce((acc, part) => acc + part.unreadMessages.length, 0)} unread messages.`,
        });
      }),
    );
  } catch (error) {
    console.error('Error in daily notification job:', error);
  }
});
