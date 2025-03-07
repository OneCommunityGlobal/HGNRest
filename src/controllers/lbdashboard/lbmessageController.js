const Message = require("../../models/lbdashboard/message");
const { sendNotification } = require("./lbnotificationController.js");

exports.sendMessage = async (req, res) => {
    try {
        const { receiver, content } = req.body;
        const newMessage = new Message({ sender: req.user.id, receiver, content });

        await newMessage.save();
        
        // Send notification immediately (no Redis queue)
        sendNotification(receiver, `New message from ${req.user.name}: ${content}`);

        res.status(201).json({ message: "Message sent successfully", data: newMessage });
    } catch (error) {
        res.status(500).json({ error: "Error sending message" });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        const messages = await Message.find({
            $or: [{ sender: req.user.id, receiver: userId }, { sender: userId, receiver: req.user.id }]
        }).sort({ timestamp: 1 });
        res.json({ messages });
    } catch (error) {
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
