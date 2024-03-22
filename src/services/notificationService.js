const mongoose = require('mongoose');
const NotificationModel = require('../models/notification');

const isValidObjectId = mongoose.Types.ObjectId.isValid;

/**
 * This function creates a new notification.
 * @param {Object} notificationData Required fields: sender: ObjectId, recipient: ObjectId, message: String.
 * Optional fields: isSystemGenerated: Boolean, isRead: Boolean, eventType: String
 * @returns {NotificationModel} The persisted notification document object.
 */
async function createNotification(notificationData) {
    if (!isValidObjectId(notificationData.sender) || !isValidObjectId(notificationData.recipient)) {
      throw new Error('Invalid sender or recipient ID');
    }

    try {
      const notification = new NotificationModel();
      notification.message = notificationData.message;
      notification.sender = notificationData.sender;
      notification.recipient = notificationData.recipient;
      notification.isSystemGenerated = notificationData.isSystemGenerated;
      notification.eventType = notificationData.eventType;
      return await notification.save();
    } catch (error) {
      throw new Error('Could not create notification: ' + error.message);
    }
  }

  /**
   * This function returns a list of notification to user.
   * @param {Mongoose.Types.ObjectId} userId The user ID
   * @returns {} A list of notifications document objects
   */
  async function getNotifications(userId) {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }
    try {
      return await NotificationModel.find().sort({ createdAt: -1 });
    } catch (error) {
      throw new Error('Could not fetch notifications: ' + error.message);
    }
}

module.exports = {
    createNotification,
    getNotifications,
};
