const mongoose = require("mongoose");

const PMNotificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, maxlength: 1000 },
    educatorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Educator", index: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PMNotification", PMNotificationSchema);
