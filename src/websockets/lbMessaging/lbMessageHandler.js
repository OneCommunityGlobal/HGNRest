const Message = require("../../models/lbdashboard/message");
const UserProfile = require("../../models/userProfile");
const mongoose = require("mongoose");

const sendMessageHandler = async (msg, userId) => {
  try {
    const { receiver, content } = msg;

    if (!userId || !receiver || !content) {
      throw new Error("Sender, receiver, and content are required.");
    }

    if (!mongoose.Types.ObjectId.isValid(receiver)) {
      throw new Error("Invalid receiver ID.");
    }

    // Create a new message with "pending" status
    const message = new Message({ sender: userId, receiver, content, status: "pending" });
    await message.save();

    message.status = "sent";
    await message.save();

    return message;
  } catch (error) {
    console.error("Error in sendMessageHandler:", error);
    throw error; // Ensure the error is properly propagated
  }
};

const getConversationHandler = async (req, res) => {
  const userId = req.headers['user-id'];
  const contactId = req.headers['contact-id'];

  try {
    if (!userId || !contactId) {
      return res.status(400).json({ error: "Both user-id and contact-id are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ error: "Invalid user-id or contact-id." });
    }

    const messages = await Message.find({
      $or: [
        { sender: mongoose.Types.ObjectId(userId), receiver: mongoose.Types.ObjectId(contactId) },
        { sender: mongoose.Types.ObjectId(contactId), receiver: mongoose.Types.ObjectId(userId) },
      ],
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
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

  return message;
};

const getMessageStatusesHandler = async (req, res) => {
  const userId = req.headers['user-id'];
  const contactId = req.headers['contact-id'];

  try {
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: contactId },
        { sender: contactId, receiver: userId },
      ],
    }).select("_id status"); 

    res.json(messages);
  } catch (error) {
    console.error("Error fetching message statuses:", error);
    res.status(500).json({ error: "Failed to fetch message statuses" });
  }
};

const getExistingChatsHandler = async (req, res) => {
  const userId = req.headers["user-id"];

  try {
    const objectId = mongoose.Types.ObjectId(userId);

    const chatUsers = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: objectId },
            { receiver: objectId },
          ],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", objectId] },
              "$receiver",
              "$sender",
            ],
          },
        },
      },
      {
        $lookup: {
          from: "userProfiles", // Replace with your user profile collection name
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          firstName: "$user.firstName",
          lastName: "$user.lastName",
          profilePic: "$user.profilePic",
        },
      },
    ]);

    res.json(chatUsers);
  } catch (error) {
    console.error("Error fetching existing chats:", error);
    res.status(500).json({ error: "Failed to fetch existing chats" });
  }
};

const searchUserProfilesHandler = async (req, res) => {
  const { query } = req.query;

  try {
    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Query parameter is required." });
    }

    const users = await UserProfile.find(
      {
        $or: [
          { firstName: { $regex: query, $options: "i" } },
          { lastName: { $regex: query, $options: "i" } },
        ],
      },
      "_id firstName lastName profilePic" 
    ).limit(15);

    res.json(users);
  } catch (error) {
    console.error("Error searching user profiles:", error);
    res.status(500).json({ error: "Failed to search user profiles" });
  }
};

const markMessagesAsRead = async (req, res) => {
  try {
    const { userId, contactId } = req.body;

    if (!userId || !contactId) {
      return res.status(400).json({ message: "User ID and Contact ID are required." });
    }

    const updatedMessages = await Message.updateMany(
      { sender: contactId, receiver: userId, status: { $ne: "read" } },
      { $set: { status: "read" } }
    );

    res.status(200).json({ message: "Messages marked as read.", updatedMessages });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ message: "Failed to mark messages as read." });
  }
};

module.exports = {
  sendMessageHandler,
  getConversationHandler,
  updateMessageStatusHandler,
  getMessageStatusesHandler,
  getExistingChatsHandler,
  searchUserProfilesHandler,
  markMessagesAsRead,
};