const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
    },
    listing_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'listings',
      required: true,
    },
    bid_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'bidoverview_Bid',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  'bidoverview_Notification',
  notificationSchema,
  'bidoverview_Notifications',
);
