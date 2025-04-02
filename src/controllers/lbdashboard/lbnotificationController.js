const Notification = require("../../models/lbdashboard/notification");
// const sendSMS = require("../utils/smsService");  // Twilio Integration
// const sendEmail = require("../utils/emailService");  // SendGrid Integration

exports.sendNotification = async (userId, messageContent) => {
    try {
        const notification = new Notification({ user: userId, type: "in-app", message: messageContent });
        await notification.save();

        // Fetch user preferences
        const user = await User.findById(userId);
        if (!user) return;

        if (user.preferences.notifySMS) {
            // await sendSMS(user.phoneNumber, messageContent);
        }
        if (user.preferences.notifyEmail) {
            // await sendEmail(user.email, "New Message", messageContent);
        }

    } catch (error) {
        console.error("Notification error:", error);
    }
};
