const Message = require("../../models/lbdashboard/message");

exports.sendMessage = async (req, res) => {
    try {
        const { receiver, content,sender } = req.body;
        const newMessage = new Message({ sender, receiver, content });

        let result=await newMessage.save();
        if(result._id)
            await Message.findByIdAndUpdate(result._id,{ status: "sent" });
        // Send notification immediately (no Redis queue)
        // sendNotification(receiver, `New message from ${req.user.name}: ${content}`);
        res.status(201).json({ message: "Message sent successfully", data: newMessage });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Error sending message" });
    }
};

exports.getMessages = async (req, res) => {
    try {
      const { userId } = req.params;
      const messages = await Message.find({
        $or: [{ receiver: userId }, { sender: userId }]
      })
        .sort({ timestamp: 1 })
        .populate('sender', 'firstName lastName role email')   // only include these fields
        .populate('receiver', 'firstName lastName role email');
      res.json({ messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Error fetching messages" });
    }
  };
  
exports.updateMessageStatus = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { status } = req.body;
        const message = await Message.findByIdAndUpdate(messageId, { status }, { new: true });

        res.json({ message });
    } catch (error) {
        res.status(500).json({ error: "Error updating message status" });
    }
};
