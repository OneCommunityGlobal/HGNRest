const mongoose = require("mongoose");

const userPreferencesSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "userProfile", required: true },
    notifyInApp: { type: Boolean, default: false },
    notifySMS: { type: Boolean, default: false },
    notifyEmail: { type: Boolean, default: false },
});

module.exports = mongoose.model("UserPreferences", userPreferencesSchema);