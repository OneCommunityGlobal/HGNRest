var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var notificationSchema = new Schema({

    message: {type: String, required: true},
    recipient : {type: Schema.Types.ObjectId, ref: 'userProfile'},
    isRead: {type: Boolean, default : false},
    eventType: {type: String, enum: [ 'Action Edited', 'Action Removed', 'Action Created']}
   
});

module.exports = mongoose.model('notification', notificationSchema, 'notifications');