const lbMessageController = function (Message, io) {
  const sendMessage = async (req, res) => {
    try {
      const { sender, receiver, content } = req.body;

      if (!sender || !receiver || !content) {
        return res.status(400).json({ message: "Sender, receiver, and content are required." });
      }

      // Create a new message with "pending" status
      const message = new Message({ sender, receiver, content, status: "pending" });
      await message.save();

      // Emit the "sent" status to the sender
      if (io) {
        io.to(sender).emit("MESSAGE_STATUS_UPDATED", {
          messageId: message._id,
          status: "sent",
        });

        // Emit the message to the receiver
        io.to(receiver).emit("RECEIVE_MESSAGE", {
          ...message.toObject(),
          status: "delivered",
        });
      } else {
        console.error("❌ Socket.IO instance is undefined");
      }

      res.status(201).json({ message: "Message sent successfully", data: message });
    } catch (error) {
      console.error("Error sending message:", error);

      // Emit the "failed" status to the sender
      if (io) {
        io.to(req.body.sender).emit("MESSAGE_STATUS_UPDATED", {
          messageId: null,
          status: "failed",
        });
      }

      res.status(500).json({ message: "Error sending message", error: error.message });
    }
  };

  const getConversation = async (req, res) => {
    try {
      const userId = req.headers.userid || req.query.userId;
      const contactId = req.headers.contactid || req.query.contactId;

      if (!userId || !contactId) {
        return res.status(400).json({ message: "User ID and Contact ID are required." });
      }

      const messages = await Message.find({
        $or: [
          { sender: userId, receiver: contactId },
          { sender: contactId, receiver: userId },
        ],
      }).sort({ timestamp: 1 });

      res.status(200).json(messages);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Error fetching conversation", error: error.message });
    }
  };

  const updateMessageStatus = async (req, res) => {
    try {
      const { messageId, status } = req.body;

      if (!messageId || typeof status === "undefined") {
        return res.status(400).json({ message: "Message ID and status are invalid." });
      }

      const message = await Message.findByIdAndUpdate(
        messageId,
        { status },
        { new: true }
      );

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Emit the updated status to the sender and receiver
      io.to(message.sender).emit("MESSAGE_STATUS_UPDATED", {
        messageId: message._id,
        status: message.status,
      });

      if (status === "read") {
        io.to(message.receiver).emit("MESSAGE_STATUS_UPDATED", {
          messageId: message._id,
          status: "read",
        });
      }

      res.status(200).json(message);
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(500).json({ message: "Error updating message status", error: error.message });
    }
  };

  return {
    sendMessage,
    getConversation,
    updateMessageStatus,
  };
};

module.exports = lbMessageController;