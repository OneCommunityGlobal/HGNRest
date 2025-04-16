const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "userProfile", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "userProfile", required: true },
    content: { type: String, required: true },
    status: { type: String, enum: ["pending", "sent", "delivered", "failed"], default: "pending" },
    isRead: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);
