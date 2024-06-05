const mongoose = require('mongoose');

const { Schema } = mongoose;

const notificationSchema = new Schema({

  message: { type: String, required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'userProfile' },
  isRead: { type: Boolean, default: false },
  eventType: { type: String },

});

module.exports = mongoose.model('notification', notificationSchema, 'notifications');
