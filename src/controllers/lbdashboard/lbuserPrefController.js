const UserPreferences = require("../../models/lbdashboard/userPreferences");

exports.updatePreferences = async (req, res) => {
    try {
        const { notifyInApp, notifySMS, notifyEmail, phoneNumber } = req.body;
        const preferences = await UserPreferences.findOneAndUpdate(
            { user: req.user.id },
            { notifyInApp, notifySMS, notifyEmail, phoneNumber },
            { new: true, upsert: true }
        );

        res.json({ message: "Preferences updated", preferences });
    } catch (error) {
        res.status(500).json({ error: "Error updating preferences" });
    }
};
