const mongoose = require('mongoose');

const { Schema } = mongoose;


const notificationSchema = new Schema({

  message: { type: String, required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'userProfile', required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'userProfile', required: true },
  isSystenGenerated: { type: Boolean, default: false },
  isRead: { type: Boolean, default: false },
  createdTimeStamps: { type: Date, default: Date.now },

});

notificationSchema.index({ recipient: 1, createdTimeStamps: 1, isRead: 1 });
notificationSchema.index({ sender: 1, createdTimeStamps: 1 });

module.exports = mongoose.model('notification', notificationSchema, 'notifications');
