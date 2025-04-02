const UserPreferences = require("../../models/lbdashboard/userPreferences");

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