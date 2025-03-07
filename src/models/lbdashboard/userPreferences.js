const mongoose = require("mongoose");

const userPreferencesSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    notifyInApp: { type: Boolean, default: true },
    notifySMS: { type: Boolean, default: false },
    notifyEmail: { type: Boolean, default: true },
    phoneNumber: { type: String }
});

module.exports = mongoose.model("UserPreferences", userPreferencesSchema);