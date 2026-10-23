const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
    },
    property_id: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  'bidoverview_Notification',
  notificationSchema,
  'bidoverview_Notifications',
);

module.exports = mongoose.model(
  'bidoverview_Notification',
  notificationSchema,
  'bidoverview_Notifications',
);
