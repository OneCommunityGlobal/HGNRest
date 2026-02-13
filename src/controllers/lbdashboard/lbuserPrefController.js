const lbUserPrefController = function (UserPreferences, Notification) {
  const normalizePhone = (phone) => {
    if (!phone) return { normalized: '', last4: '' };
    const trimmed = String(phone).trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    const normalized = hasPlus ? `+${digits}` : digits;
    return { normalized, last4: digits.slice(-4) };
  };

  const maskPhone = (phone) => {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    return `***-***-${digits.slice(-4)}`;
  };
  const getPreferences = async (req, res) => {
    try {
      const { userId, selectedUserId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
      }

      const preferences = await UserPreferences.findOne({ user: userId }).populate(
        'users.userNotifyingFor',
      );

      if (!preferences) {
        return res.status(404).json({ message: 'Preferences not found for the user.' });
      }

      if (selectedUserId) {
        const selectedUserPref = preferences.users.find(
          (pref) => pref.userNotifyingFor._id.toString() === selectedUserId,
        );

        return res.status(200).json(selectedUserPref || { notifyInApp: false, notifyEmail: false });
      }

      const response = preferences.toObject();
      response.smsPhoneMasked = maskPhone(preferences.smsPhone);
      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching preferences:', error);
      res.status(500).json({ message: 'Error fetching preferences', error: error.message });
    }
  };

  const updatePreferences = async (req, res) => {
    try {
      const { userId, selectedUserId, notifyInApp, notifyEmail, notifySms, smsPhone } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
      }

      let preferences = await UserPreferences.findOne({ user: userId });

      if (!preferences) {
        preferences = new UserPreferences({ user: userId, users: [] });
      }

      if (selectedUserId) {
        const userIndex = preferences.users.findIndex(
          (user) => user.userNotifyingFor.toString() === selectedUserId,
        );

        if (userIndex === -1) {
          preferences.users.push({
            userNotifyingFor: selectedUserId,
            notifyInApp: notifyInApp !== undefined ? notifyInApp : false,
            notifyEmail: notifyEmail !== undefined ? notifyEmail : false,
          });
        } else {
          preferences.users[userIndex].notifyInApp =
            notifyInApp !== undefined ? notifyInApp : false;
          preferences.users[userIndex].notifyEmail =
            notifyEmail !== undefined ? notifyEmail : false;
        }
      } else if (notifyInApp !== undefined || notifyEmail !== undefined) {
        if (notifyInApp !== undefined) {
          preferences.notifyInApp = notifyInApp;
        }
        if (notifyEmail !== undefined) {
          preferences.notifyEmail = notifyEmail;
        }
      }

      if (notifySms !== undefined || smsPhone !== undefined) {
        const { normalized, last4 } = normalizePhone(smsPhone);
        const digits = normalized.replace(/\D/g, '');
        const existingDigits = String(preferences.smsPhone || '').replace(/\D/g, '');
        if (notifySms && digits.length === 0 && existingDigits.length === 0) {
          return res.status(400).json({ message: 'SMS phone number is required.' });
        }
        if (digits.length > 0 && (digits.length < 8 || digits.length > 15)) {
          return res.status(400).json({ message: 'Invalid phone number format.' });
        }
        if (notifySms !== undefined) {
          preferences.notifySms = notifySms;
        }
        if (smsPhone !== undefined && digits.length > 0) {
          preferences.smsPhone = normalized;
          preferences.smsPhoneLast4 = last4;
        }
      }

      const updatedPreferences = await preferences.save();
      res.status(200).json(updatedPreferences);
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({ message: 'Error updating preferences', error: error.message });
    }
  };

  const storeNotification = async (req, res) => {
    try {
      const { userId, senderId, message } = req.body;

      if (!userId || !senderId || !message) {
        return res.status(400).json({ message: 'User ID, Sender ID, and Message are required.' });
      }

      const notification = new Notification({
        message,
        sender: senderId,
        recipient: userId,
        isSystemGenerated: false,
      });

      await notification.save();
      res.status(201).json({ message: 'Notification stored successfully.', notification });
    } catch (error) {
      console.error('❌ Error storing notification:', error);
      res.status(500).json({ message: 'Error storing notification.', error: error.message });
    }
  };

  const getUnreadNotifications = async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        console.error('❌ User ID is missing in the request.');
        return res.status(400).json({ message: 'User ID is required.' });
      }

      const notifications = await Notification.find({ recipient: userId, isRead: false })
        .sort({ createdTimeStamps: -1 })
        .populate('sender', 'firstName lastName'); // Include sender's name

      res.status(200).json(notifications);
    } catch (error) {
      console.error('❌ Error fetching unread notifications:', error);
      res
        .status(500)
        .json({ message: 'Error fetching unread notifications.', error: error.message });
    }
  };

  const markNotificationsAsRead = async (req, res) => {
    try {
      const { notificationIds } = req.body;

      if (!notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({ message: 'Invalid notification IDs.' });
      }
      const result = await Notification.updateMany(
        { _id: { $in: notificationIds } },
        { isRead: true },
      );

      res.status(200).json({ message: 'Notifications marked as read.', result });
    } catch (error) {
      console.error('❌ Error marking notifications as read:', error);
      res
        .status(500)
        .json({ message: 'Error marking notifications as read.', error: error.message });
    }
  };

  return {
    getPreferences,
    updatePreferences,
    storeNotification,
    getUnreadNotifications,
    markNotificationsAsRead,
  };
};

module.exports = lbUserPrefController;
