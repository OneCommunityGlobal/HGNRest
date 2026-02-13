/* eslint-disable no-unused-vars */
const Websockets = require('ws');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../../config');
// eslint-disable-next-line no-unused-vars
const Message = require('../../models/lbdashboard/message');
const Notification = require('../../models/notification');
const UserProfile = require('../../models/userProfile');
const UserPreference = require('../../models/lbdashboard/userPreferences');
const { queueSmsNotification } = require('../../utilities/smsQueue');
const emailSender = require('../../utilities/emailSender');
const { sendMessageHandler, updateMessageStatusHandler } = require('./lbMessageHandler');

const authenticate = (req, res) => {
  const authToken = req.headers?.['sec-websocket-protocol'];

  if (!authToken) {
    res('401 Unauthorized', null);
    return;
  }

  try {
    const payload = jwt.verify(authToken, config.JWT_SECRET);
    res(null, payload.userid);
  } catch (error) {
    res('401 Unauthorized', null);
  }
};

export default () => {
  const wss = new Websockets.Server({
    noServer: true,
  });

  const handleUpgrade = (request, socket, head) => {
    authenticate(request, (err, client) => {
      if (err || !client) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      request.userId = client;
      wss.handleUpgrade(request, socket, head, (websocket) => {
        wss.emit('connection', websocket, request);
      });
    });
  };

  // Store multiple connections per user: { userId: [{ socket, isActive, inChatWith }] }
  const userConnections = new Map();

  // Helper functions for connection management
  const addUserConnection = (userId, ws) => {
    if (!userConnections.has(userId)) {
      userConnections.set(userId, []);
    }
    userConnections.get(userId).push({ socket: ws, isActive: true, inChatWith: null });
  };

  const removeUserConnection = (userId, ws) => {
    const connections = userConnections.get(userId);
    if (!connections) return;

    const connectionIndex = connections.findIndex((conn) => conn.socket === ws);
    if (connectionIndex !== -1) {
      connections.splice(connectionIndex, 1);
      if (connections.length === 0) {
        userConnections.delete(userId);
      }
    }
  };

  const getActiveConnections = (userId) => {
    const connections = userConnections.get(userId);
    if (!connections) return [];

    // Filter out closed connections
    const activeConnections = connections.filter(
      (conn) => conn.socket && conn.socket.readyState === Websockets.OPEN,
    );

    // Update the connections array if any were filtered out
    if (activeConnections.length !== connections.length) {
      userConnections.set(userId, activeConnections);
      if (activeConnections.length === 0) {
        userConnections.delete(userId);
      }
    }

    return activeConnections;
  };

  const broadcastToUser = (userId, message) => {
    const activeConnections = getActiveConnections(userId);
    activeConnections.forEach((conn) => {
      try {
        if (conn.socket.readyState === Websockets.OPEN) {
          conn.socket.send(JSON.stringify(message));
        }
      } catch (error) {
        console.error('Failed to send message to user:', error);
      }
    });
  };

  const sendNewMessageEmail = async (receiverId, senderName) => {
    try {
      const receiverProfile = await UserProfile.findById(receiverId).select(
        'email firstName lastName',
      );
      if (!receiverProfile?.email) return;
      const subject = `New message from ${senderName}`;
      const body = `
        <p>Hi ${receiverProfile.firstName || 'there'},</p>
        <p>You received a new message from ${senderName}.</p>
        <p>Log in to view and reply.</p>
      `;
      await emailSender(receiverProfile.email, subject, body, null, null, null, null, {
        type: 'lb_message',
        recipientUserId: receiverId,
      });
    } catch (error) {
      console.error('Failed to send message email:', error.message);
    }
  };

  const sendNewMessageSms = (userPreference, senderName) => {
    if (userPreference?.notifySms && userPreference?.smsPhone) {
      queueSmsNotification({
        to: userPreference.smsPhone,
        message: `New message from ${senderName}`,
      });
    }
  };

  const broadcastStatusUpdate = async (messageId, status /* userId */) => {
    const message = await Message.findByIdAndUpdate(messageId, { status }, { new: true });

    if (!message) return;

    // Broadcast to sender
    broadcastToUser(message.sender, {
      action: 'MESSAGE_STATUS_UPDATED',
      payload: { messageId: message._id, status },
    });

    // Broadcast to receiver
    broadcastToUser(message.receiver, {
      action: 'MESSAGE_STATUS_UPDATED',
      payload: { messageId: message._id, status },
    });
  };

  wss.on('connection', (ws, req) => {
    const { userId } = req;
    addUserConnection(userId, ws);

    ws.on('message', async (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.action === 'SEND_MESSAGE') {
        try {
          const savedMessage = await sendMessageHandler(msg, userId);

          // Send confirmation to sender
          broadcastToUser(userId, {
            action: 'RECEIVE_MESSAGE',
            payload: savedMessage,
          });

          const senderProfile = await UserProfile.findById(userId).select('firstName lastName');
          const senderName = `${senderProfile.firstName} ${senderProfile.lastName}`;

          // Check if receiver has active connections
          const receiverConnections = getActiveConnections(msg.receiver);
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
            broadcastToUser(msg.receiver, {
              action: 'RECEIVE_MESSAGE',
              payload: savedMessage,
            });

            // Send notification if receiver is active but not in chat with sender
            if (isReceiverActive && !isReceiverInChat) {
              const userPreference = await UserPreference.findOne({ user: msg.receiver });
              const allowGlobalInApp =
                userPreference?.notifyInApp === undefined ? true : userPreference.notifyInApp;
              const isSenderInPreference = userPreference?.users.some(
                (pref) => pref.userNotifyingFor.toString() === userId && pref.notifyInApp === true,
              );

              if (allowGlobalInApp && isSenderInPreference) {
                broadcastToUser(msg.receiver, {
                  action: 'NEW_NOTIFICATION',
                  payload: `You got a message from ${senderName}`,
                });
              }

              if (userPreference?.notifyEmail) {
                sendNewMessageEmail(msg.receiver, senderName);
              }

              sendNewMessageSms(userPreference, senderName);
            }
          } else {
            // Receiver is offline, create notification
            const userPreference = await UserPreference.findOne({ user: msg.receiver });
            const allowGlobalInApp =
              userPreference?.notifyInApp === undefined ? true : userPreference.notifyInApp;
            const isSenderInPreference = userPreference?.users.some(
              (pref) => pref.userNotifyingFor.toString() === userId && pref.notifyInApp === true,
            );
            if (allowGlobalInApp && isSenderInPreference) {
              const notification = new Notification({
                message: `You got a message from ${senderName}`,
                sender: userId,
                recipient: msg.receiver,
                isSystemGenerated: false,
              });
              await notification.save();
            }

            sendNewMessageSms(userPreference, senderName);

            if (userPreference?.notifyEmail) {
              sendNewMessageEmail(msg.receiver, senderName);
            }
          }

          broadcastStatusUpdate(savedMessage._id, savedMessage.status, userId);
        } catch (error) {
          console.error('❌ Error sending message:', error);
          ws.send(
            JSON.stringify({
              action: 'SEND_MESSAGE_FAILED',
              error: 'Could not send message',
            }),
          );
        }
      } else if (msg.action === 'UPDATE_CHAT_STATE') {
        // Update chat state for all connections of this user
        const connections = getActiveConnections(userId);
        connections.forEach((conn) => {
          conn.isActive = msg.isActive;
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
          broadcastToUser(contactId, {
            action: 'MESSAGE_STATUS_UPDATED',
            payload: { contactId, status: 'read' },
          });
        } catch (error) {
          console.error('❌ Error marking messages as read:', error);
        }
      }
    });

    ws.on('close', () => {
      removeUserConnection(userId, ws);
    });
  });

  return { path: '/messaging-service', handleUpgrade };
};
