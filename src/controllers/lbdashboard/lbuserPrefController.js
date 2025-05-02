const lbUserPrefController = function (UserPreferences) {
  const getPreferences = async (req, res) => {
    try {
      const { userId, selectedUserId } = req.body;
  
      if (!userId) {
        return res.status(400).json({ message: "User ID is required." });
      }
  
      const preferences = await UserPreferences.findOne({ user: userId }).populate("users.userNotifyingFor");
    
      if (!preferences) {
        return res.status(404).json({ message: "Preferences not found for the user." });
      }
  
      if (selectedUserId) {
        const selectedUserPref = preferences.users.find(
          (pref) => pref.userNotifyingFor._id.toString() === selectedUserId
        );
    
        return res.status(200).json(selectedUserPref || { notifyInApp: false, notifyEmail: false });
      }
  
      res.status(200).json(preferences);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Error fetching preferences", error: error.message });
    }
  };

  const updatePreferences = async (req, res) => {
    try {
      const { userId, selectedUserId, notifyInApp, notifyEmail } = req.body;
  
      if (!userId || !selectedUserId) {
        return res.status(400).json({ message: "User ID and Selected User ID are required." });
      }
  
      const preferences = await UserPreferences.findOne({ user: userId });
  
      if (!preferences) {
        const newPreferences = new UserPreferences({
          user: userId,
          users: [
            {
              userNotifyingFor: selectedUserId,
              notifyInApp: notifyInApp !== undefined ? notifyInApp : false,
              notifyEmail: notifyEmail !== undefined ? notifyEmail : false,
            },
          ],
        });
  
        await newPreferences.save();
        return res.status(200).json(newPreferences);
      }
  
      const userIndex = preferences.users.findIndex(
        (user) => user.userNotifyingFor.toString() === selectedUserId
      );
  
      if (userIndex === -1) {
        preferences.users.push({
          userNotifyingFor: selectedUserId,
          notifyInApp: notifyInApp !== undefined ? notifyInApp : false,
          notifyEmail: notifyEmail !== undefined ? notifyEmail : false,
        });
      } else {
        preferences.users[userIndex].notifyInApp = notifyInApp !== undefined ? notifyInApp : false;
        preferences.users[userIndex].notifyEmail = notifyEmail !== undefined ? notifyEmail : false;
      }
  
      const updatedPreferences = await preferences.save();
      res.status(200).json(updatedPreferences);
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