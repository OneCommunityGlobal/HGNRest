const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/, // Ensures the format is like "2025-02-27"
  },
}, { timestamps: true });

module.exports = mongoose.model('bidoverview_Notification', notificationSchema, 'bidoverview_Notifications');