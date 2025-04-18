const lbMessageController = function (Message) {
  const sendMessage = async (req, res) => {
    try {
      const { sender, receiver, content } = req.body;

      if (!sender || !receiver || !content) {
        return res.status(400).json({ message: "Sender, receiver, and content are required." });
      }

      const message = new Message({ sender, receiver, content });
      await message.save();

      res.status(201).json({ message: "Message sent successfully", data: message });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Error sending message", error: error.message });
    }
  };

  const getConversation = async (req, res) => {
    try {
      console.log("getConversation called");
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
      console.error("Error fetching conversation:", error); // Log the error details
      res.status(500).json({ message: "Error fetching conversation", error: error.message });
    }
  };

  const updateMessageStatus = async (req, res) => {
    try {
      const { messageId, isRead } = req.body;

      if (!messageId || typeof isRead === "undefined") {
        return res.status(400).json({ message: "Message ID and isRead status are required." });
      }

      const message = await Message.findByIdAndUpdate(
        messageId,
        { isRead },
        { new: true }
      );

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
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