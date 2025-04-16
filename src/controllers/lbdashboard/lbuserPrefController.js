const UserPreferences = require("../../models/lbdashboard/userPreferences");
const emailSender = require('../../utilities/emailSender');

exports.updatePreferences = async (req, res) => {
    try {
        const { notifyInApp, notifySMS, notifyEmail} = req.body;
        const preferences = await UserPreferences.findOneAndUpdate(
            { user: req.params.userId },
            { notifyInApp, notifySMS, notifyEmail},
            { new: true, upsert: true }
        );
        res.json({ message: "Preferences updated", preferences });
    } catch (error) {
        res.status(500).json({ error: "Error updating preferences" });
    }
};

exports.getUserPreferences = async (req, res) => {
    try {
        const preferences = await UserPreferences.findOne({ user: req.params.userId });
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ error: "Error fetching preferences" });
    }
}

// email sending route and as well as sms sending logic.
exports.lbsendEmail = async (req, res) => {
    try {
        const { email, content ,senderName} = req.body;
        const subject = "No-Reply - HGN Listing & Bidding : Message from " + senderName;
        const message = `
            <h1>Message from ${senderName}</h1>
            <p>${content}</p>
            <p>Check Message at Listing And Bidding Platform on www.highestgoodnetwork.com</p>
        `;
        emailSender(email, subject, message);
        res.json({ message: "Email sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error sending email" });
    }
};

exports.lbsendSMS = async (req, res) => {
    try {
        // Implement SMS sending logic here
        // For example, using Twilio or any other SMS service
        res.json({ message: "SMS sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error sending SMS" });
    }
}