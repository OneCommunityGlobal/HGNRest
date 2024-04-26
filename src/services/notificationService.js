/**
 * This module contains functions for creating and fetching notifications. {@link NotificationModel}
 */
const mongoose = require('mongoose');
const NotificationModel = require('../models/notification');
const { cleanHtml } = require('../utilities/htmlContentSanitizer');

const { startSession } = mongoose;
const isValidObjectId = mongoose.Types.ObjectId.isValid;

/**
 * This function creates new notification for the given recipients.
 * @param {Object} notificationData Required fields: sender: ObjectId, recipients: List of ObjectId, message: String.
 * Optional fields: isSystemGenerated: Boolean, isRead: Boolean
 * @returns {NotificationModel} The persisted notification document object.
 */
async function createNotification(
  senderId,
  recipientIds,
  message,
  isSystemGenerated = false,
  isRead = false,
) {
  const isValidRecipientId = recipientIds ? (Array.isArray(recipientIds) && recipientIds.length > 0 && recipientIds.every((id) => isValidObjectId(id))) : false;

  if (!isValidObjectId(senderId)) {
    throw new Error(`Invalid sender ID ${ senderId }`);
  }
  if (!isValidRecipientId) {
    throw new Error(`Invalid recipient ID ${ recipientIds.toString() }`);
  }

  const session = await startSession();
  try {
    // Start a transaction and rollback if any error occurs
    session.startTransaction();
    const sanitizedMessage = cleanHtml(message.trim());
    const models = recipientIds.map((recipientId) => ({
        message: sanitizedMessage,
        sender: senderId,
        recipient: recipientId,
        isSystemGenerated,
        isRead,
        createdTimeStamps: new Date(),
      }));

    const result = await NotificationModel.insertMany(models, { session });
    await session.commitTransaction();
    session.endSession();

    return result;
  } catch (error) {
    // Abort the transaction and rollback
    await session.abortTransaction();
    session.endSession();

    throw new Error(`Could not create notification: ${ error.message}`);
  }
}

/**
 * This function returns a list of notification to user.
 * @param {Mongoose.Types.ObjectId} userId The user ID
 * @returns {} A list of notifications document objects
 */
async function getNotifications(userId) {
  if (!isValidObjectId(userId)) {
    throw new Error(`Invalid user ID ${ userId }`);
  }
  try {
    return await NotificationModel.find({ recipient: userId })
      .populate('userInfo', 'recipientInfo')
      .sort({ createdTimeStamps: -1 });
  } catch (error) {
    throw new Error(`Could not fetch notifications: ${ error.message}`);
  }
}

/**
 * This function returns a list of unread notifications to user.
 * @param {Mongoose.Types.ObjectId} userId The user ID
 * @returns {} A list of unread notifications document objects
 */
async function getUnreadUserNotifications(userId) {
  if (!isValidObjectId(userId)) {
    throw new Error(`Invalid user ID ${ userId }`);
  }
  try {
    return await NotificationModel.find({ recipient: userId, isRead: false })
      .populate('userInfo', 'recipientInfo')
      .sort({ createdTimeStamps: -1 });
  } catch (error) {
    throw new Error(`Could not fetch notifications user ${ userId }: ${ error.message}`);
  }
}

/**
 * This function returns a list of notifications sent by the admin/owner user.
 * @param {*} senderId The sender ID
 * @returns a list of notification document objects
 */
async function getSentNotifications(senderId) {
  if (!isValidObjectId(senderId)) {
    throw new Error(`Invalid sender ID ${ senderId }`);
  }
  try {
    return await NotificationModel.find({ sender: senderId })
      .populate('userInfo', 'senderInfo')
      .sort({ createdTimeStamps: -1 });
  } catch (error) {
    throw new Error(`Could not fetch notifications for user ${ senderId }: ${ error.message}`);
  }
}

/**
 * This function marks a notification as read. The recipient should match with the requestor ID.
 * @param {Mongoose.Types.ObjectId} notificationId The notification ID
 * @returns {NotificationModel} The updated notification document object
 */
async function markNotificationAsRead(notificationId, recipientId) {
  if (!isValidObjectId(notificationId)) {
    throw new Error(`Invalid notification ID: ${ notificationId }`);
  }
  try {
    return await NotificationModel.findOneAndUpdate({ _id: notificationId, recipient: recipientId }, { isRead: true }, { new: true });
  } catch (error) {
    throw new Error(`Could not mark notification as read: ${ error.message}`);
  }
}

/**
 * This function deletes a notification.
 * @param {Mongoose.Types.ObjectId} notificationId The notification ID
 * @returns {NotificationModel} The deleted notification document object
 */
async function deleteNotification(notificationId) {
  if (!isValidObjectId(notificationId)) {
    throw new Error(`Invalid notification ID: ${ notificationId }`);
  }
  try {
    return await NotificationModel.findByIdAndDelete(notificationId);
  } catch (error) {
    throw new Error(`Could not delete notification ${ notificationId }: ${ error.message} `);
  }
}

module.exports = {
  createNotification,
  getNotifications,
  getUnreadUserNotifications,
  getSentNotifications,
  markNotificationAsRead,
  deleteNotification,
};
