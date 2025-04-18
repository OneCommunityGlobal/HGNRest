const lbUserPrefController = function (UserPreferences) {
    const getPreferences = async (req, res) => {
      try {
        const { userId } = req.body;
  
        if (!userId) {
          return res.status(400).json({ message: "User ID is required." });
        }
  
        const preferences = await UserPreferences.findOne({ user: userId });
  
        res.status(200).json(preferences);
      } catch (error) {
        console.error("Error fetching preferences:", error);
        res.status(500).json({ message: "Error fetching preferences", error: error.message });
      }
    };
  
    const updatePreferences = async (req, res) => {
      try {
        const { userId, notifyInApp, notifySMS, notifyEmail, phoneNumber } = req.body;
  
        if (!userId) {
          return res.status(400).json({ message: "User ID is required." });
        }
  
        const preferences = await UserPreferences.findOneAndUpdate(
          { user: userId },
          { notifyInApp, notifySMS, notifyEmail, phoneNumber },
          { new: true, upsert: true }
        );
  
        res.status(200).json(preferences);
      } catch (error) {
        console.error("Error updating preferences:", error);
        res.status(500).json({ message: "Error updating preferences", error: error.message });
      }
    };
  
    return {
      getPreferences,
      updatePreferences,
    };
  };
  
  module.exports = lbUserPrefController;