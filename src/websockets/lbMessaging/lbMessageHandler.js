const Message = require("../../models/lbdashboard/message");
const connections = new Map(); // { userId: socket }

const sendMessageHandler = async (msg, userId) => {
  const { receiver, content } = msg;

  if (!userId || !receiver || !content) {
    throw new Error("Sender, receiver, and content are required.");
  }

  // Create a new message with "pending" status
  const message = new Message({ sender: userId, receiver, content, status: "pending" });
  await message.save();

  // Emit the "sent" status to the sender
  const senderSocket = connections.get(userId);
  if (senderSocket) {
    senderSocket.emit("MESSAGE_STATUS_UPDATED", {
      messageId: message._id,
      status: "sent",
    });
  }

  // Emit the message to the receiver
  const receiverSocket = connections.get(receiver);
  if (receiverSocket) {
    receiverSocket.emit("RECEIVE_MESSAGE", {
      ...message.toObject(),
      status: "delivered",
    });
  }

  return message;
};

const getConversationHandler = async (userId, contactId) => {
  if (!userId || !contactId) {
    throw new Error("User ID and Contact ID are required.");
  }

  const messages = await Message.find({
    $or: [
      { sender: userId, receiver: contactId },
      { sender: contactId, receiver: userId },
    ],
  }).sort({ timestamp: 1 });

  return messages;
};

const updateMessageStatusHandler = async (msg) => {
  const { messageId, status } = msg;

  if (!messageId || typeof status === "undefined") {
    throw new Error("Message ID and status are invalid.");
  }

  const message = await Message.findByIdAndUpdate(
    messageId,
    { status },
    { new: true }
  );

  if (!message) {
    throw new Error("Message not found");
  }

  // Emit the updated status to the sender and receiver
  const senderSocket = connections.get(message.sender);
  if (senderSocket) {
    senderSocket.emit("MESSAGE_STATUS_UPDATED", {
      messageId: message._id,
      status: message.status,
    });
  }

  if (status === "read") {
    const receiverSocket = connections.get(message.receiver);
    if (receiverSocket) {
      receiverSocket.emit("MESSAGE_STATUS_UPDATED", {
        messageId: message._id,
        status: "read",
      });
    }
  }

  return message;
};

module.exports = {
  sendMessageHandler,
  getConversationHandler,
  updateMessageStatusHandler,
};