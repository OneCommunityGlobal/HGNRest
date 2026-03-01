const logger = require('../../startup/logger');
const UserProfile = require('../../models/userProfile');
const UserPreference = require('../../models/lbdashboard/userPreferences');
const Notification = require('../../models/notification');
const Message = require('../../models/lbdashboard/message');
const { sendMessageHandler } = require('./lbMessageHandler');

const broadcastStatusUpdate = async (connectionManager, messageId, status) => {
  const message = await Message.findByIdAndUpdate(messageId, { status }, { new: true });

  if (!message) return;

  // Broadcast to sender
  connectionManager.broadcastToUser(message.sender, {
    action: 'MESSAGE_STATUS_UPDATED',
    payload: { messageId: message._id, status },
  });

  // Broadcast to receiver
  connectionManager.broadcastToUser(message.receiver, {
    action: 'MESSAGE_STATUS_UPDATED',
    payload: { messageId: message._id, status },
  });
};

const handleSocketMessage = async (msg, userId, ws, connectionManager) => {
  if (msg.action === 'SEND_MESSAGE') {
    try {
      const savedMessage = await sendMessageHandler(msg, userId);

      // Send confirmation to sender
      connectionManager.broadcastToUser(userId, {
        action: 'RECEIVE_MESSAGE',
        payload: savedMessage,
      });

      const senderProfile = await UserProfile.findById(userId).select('firstName lastName');
      const senderName = `${senderProfile.firstName} ${senderProfile.lastName}`;

      // Check if receiver has active connections
      const receiverConnections = connectionManager.getActiveConnections(msg.receiver);
      if (receiverConnections.length > 0) {
        // Determine message status based on receiver's state
        const isReceiverInChat = receiverConnections.some((conn) => conn.inChatWith === userId);
        const isReceiverActive = receiverConnections.some((conn) => conn.isActive);

        if (isReceiverInChat) {
          savedMessage.status = 'read';
        } else if (isReceiverActive) {
          savedMessage.status = 'delivered';
        } else {
          savedMessage.status = 'sent';
        }
        await savedMessage.save();

        // Send message to all receiver connections
        connectionManager.broadcastToUser(msg.receiver, {
          action: 'RECEIVE_MESSAGE',
          payload: savedMessage,
        });

        // Send notification if receiver is active but not in chat with sender
        if (isReceiverActive && !isReceiverInChat) {
          const userPreference = await UserPreference.findOne({ user: msg.receiver });
          const isSenderInPreference = userPreference?.users.some(
            (pref) => pref.userNotifyingFor.toString() === userId && pref.notifyInApp === true,
          );

          if (isSenderInPreference) {
            connectionManager.broadcastToUser(msg.receiver, {
              action: 'NEW_NOTIFICATION',
              payload: `You got a message from ${senderName}`,
            });
          }
        }
      } else {
        // Receiver is offline, create notification
        const userPreference = await UserPreference.findOne({ user: msg.receiver });
        const isSenderInPreference = userPreference?.users.some(
          (pref) => pref.userNotifyingFor.toString() === userId && pref.notifyInApp === true,
        );
        if (isSenderInPreference) {
          const notification = new Notification({
            message: `You got a message from ${senderName}`,
            sender: userId,
            recipient: msg.receiver,
            isSystemGenerated: false,
          });
          await notification.save();
        }
      }

      broadcastStatusUpdate(connectionManager, savedMessage._id, savedMessage.status);
    } catch (error) {
      logger.logException(error);
      ws.send(
        JSON.stringify({
          action: 'SEND_MESSAGE_FAILED',
          error: 'Could not send message',
        }),
      );
    }
  } else if (msg.action === 'UPDATE_CHAT_STATE') {
    // Update chat state for all connections of this user
    const connections = connectionManager.getActiveConnections(userId);
    connections.forEach((conn) => {
      // eslint-disable-next-line no-param-reassign
      conn.isActive = msg.isActive;
      // eslint-disable-next-line no-param-reassign
      conn.inChatWith = msg.inChatWith || null;
    });
  } else if (msg.action === 'MARK_MESSAGES_AS_READ') {
    try {
      const { contactId } = msg;
      if (!contactId) {
        throw new Error('Contact ID is required to mark messages as read.');
      }

      // eslint-disable-next-line no-unused-vars
      const updatedMessages = await Message.updateMany(
        { sender: contactId, receiver: userId, status: { $ne: 'read' } },
        { $set: { status: 'read' } },
      );

      // Notify sender about read status
      connectionManager.broadcastToUser(contactId, {
        action: 'MESSAGE_STATUS_UPDATED',
        payload: { contactId, status: 'read' },
      });
    } catch (error) {
      logger.logException(error);
    }
  }
};

module.exports = { handleSocketMessage };
