const mongoose = require('mongoose');

const lbUserPrefController = function (UserPreferences, Notification) {
  const normalizeObjectId = (value) => {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!mongoose.Types.ObjectId.isValid(trimmed)) return null;

    return trimmed;
  };

  const normalizeObjectIdList = (values) => {
    if (!Array.isArray(values)) return null;

    const normalizedIds = values.map(normalizeObjectId);
    return normalizedIds.every(Boolean) ? normalizedIds : null;
  };

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
      const normalizedUserId = normalizeObjectId(userId);
      const normalizedSelectedUserId = selectedUserId
        ? normalizeObjectId(selectedUserId)
        : null;

      if (!normalizedUserId) {
        return res.status(400).json({ message: 'A valid user ID is required.' });
      }

      if (selectedUserId && !normalizedSelectedUserId) {
        return res.status(400).json({ message: 'Selected user ID must be a valid ID.' });
      }

      const preferences = await UserPreferences.findOne({ user: normalizedUserId }).populate(
        'users.userNotifyingFor',
      );

      if (!preferences) {
        return res.status(404).json({ message: 'Preferences not found for the user.' });
      }

      if (normalizedSelectedUserId) {
        const selectedUserPref = preferences.users.find(
          (pref) => pref.userNotifyingFor._id.toString() === normalizedSelectedUserId,
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
      const normalizedUserId = normalizeObjectId(userId);
      const normalizedSelectedUserId = selectedUserId
        ? normalizeObjectId(selectedUserId)
        : null;

      if (!normalizedUserId) {
        return res.status(400).json({ message: 'A valid user ID is required.' });
      }

      if (selectedUserId && !normalizedSelectedUserId) {
        return res.status(400).json({ message: 'Selected user ID must be a valid ID.' });
      }

      let preferences = await UserPreferences.findOne({ user: normalizedUserId });

      if (!preferences) {
        preferences = new UserPreferences({ user: normalizedUserId, users: [] });
      }

      if (normalizedSelectedUserId) {
        const userIndex = preferences.users.findIndex(
          (user) => user.userNotifyingFor.toString() === normalizedSelectedUserId,
        );

        if (userIndex === -1) {
          preferences.users.push({
            userNotifyingFor: normalizedSelectedUserId,
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
      const normalizedUserId = normalizeObjectId(userId);
      const normalizedSenderId = normalizeObjectId(senderId);

      if (!normalizedUserId || !normalizedSenderId || !message) {
        return res.status(400).json({ message: 'User ID, Sender ID, and Message are required.' });
      }

      const notification = new Notification({
        message,
        sender: normalizedSenderId,
        recipient: normalizedUserId,
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
      const normalizedUserId = normalizeObjectId(userId);

      if (!normalizedUserId) {
        console.error('❌ User ID is missing in the request.');
        return res.status(400).json({ message: 'A valid user ID is required.' });
      }

      const notifications = await Notification.find({ recipient: normalizedUserId, isRead: false })
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
      const normalizedNotificationIds = normalizeObjectIdList(notificationIds);

      if (!normalizedNotificationIds) {
        return res.status(400).json({ message: 'Invalid notification IDs.' });
      }
      const result = await Notification.updateMany(
        { _id: { $in: normalizedNotificationIds } },
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
