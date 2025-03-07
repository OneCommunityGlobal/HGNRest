const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    type: { type: String, enum: ["in-app", "email", "sms"], required: true },
    status: { type: String, enum: ["sent", "failed"], default: "sent" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", notificationSchema);
